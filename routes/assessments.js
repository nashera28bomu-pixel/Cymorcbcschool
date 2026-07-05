const express = require("express");
const AssessmentRecord = require("../models/AssessmentRecord");
const TeacherAssignment = require("../models/TeacherAssignment");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const MarkingScheme = require("../models/MarkingScheme");
const { getBandForMark } = require("../utils/cbcGradingEngine");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

/**
 * Confirms a teacher is allowed to grade this subject for this student's
 * stream. school_admin bypasses this check entirely.
 */
async function canGrade(user, schoolId, subjectId, streamId) {
  if (user.role === "school_admin") return true;
  const assignment = await TeacherAssignment.findOne({ schoolId, teacherId: user._id, subjectId, streamId });
  return !!assignment;
}

/**
 * If a teacher doesn't type their own comment, fall back to the marking
 * scheme's default comment for whichever band the mark falls into —
 * saves re-typing "Meets expectations, good progress" 40 times a class.
 */
async function resolveComment(schoolId, mark, providedComment) {
  if (providedComment) return providedComment;
  const scheme = await MarkingScheme.findOne({ schoolId, isDefault: true });
  if (!scheme) return "";
  const band = getBandForMark(mark, scheme.bands);
  return band ? band.defaultComment : "";
}

/**
 * POST /api/assessments
 * Enter/update one mark for one student, one subject, one term.
 */
router.post("/", requireRole("school_admin", "teacher"), async (req, res) => {
  const { studentId, subjectId, termId, mark, comment } = req.body;

  if (!studentId || !subjectId || !termId || mark === undefined) {
    return res.status(400).json({ error: "studentId, subjectId, termId, and mark are required." });
  }
  if (typeof mark !== "number" || mark < 0 || mark > 100) {
    return res.status(400).json({ error: "mark must be a number between 0 and 100." });
  }

  const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
  if (!student) return res.status(404).json({ error: "Student not found." });

  const allowed = await canGrade(req.user, req.schoolId, subjectId, student.streamId);
  if (!allowed) {
    return res.status(403).json({ error: "You're not assigned to teach this subject for this student's class." });
  }

  const resolvedComment = await resolveComment(req.schoolId, mark, comment);

  const record = await AssessmentRecord.findOneAndUpdate(
    { schoolId: req.schoolId, studentId, subjectId, termId },
    { mark, comment: resolvedComment, enteredBy: req.user._id },
    { new: true, upsert: true }
  );

  res.status(201).json(record);
});

/**
 * POST /api/assessments/bulk
 * Enter marks for an entire class at once for one subject/term — matches
 * how a teacher actually grades (30-40 students in one sitting).
 *
 * body: { subjectId, termId, entries: [{ studentId, mark, comment? }] }
 */
router.post("/bulk", requireRole("school_admin", "teacher"), async (req, res) => {
  const { subjectId, termId, entries } = req.body;

  if (!subjectId || !termId || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "subjectId, termId, and a non-empty entries array are required." });
  }

  const studentIds = entries.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds }, schoolId: req.schoolId });
  const studentById = new Map(students.map((s) => [s._id.toString(), s]));

  const results = [];
  const errors = [];

  for (const entry of entries) {
    const student = studentById.get(entry.studentId);
    if (!student) {
      errors.push({ studentId: entry.studentId, error: "Student not found." });
      continue;
    }
    if (typeof entry.mark !== "number" || entry.mark < 0 || entry.mark > 100) {
      errors.push({ studentId: entry.studentId, error: "mark must be a number between 0 and 100." });
      continue;
    }

    const allowed = await canGrade(req.user, req.schoolId, subjectId, student.streamId);
    if (!allowed) {
      errors.push({ studentId: entry.studentId, error: "Not assigned to teach this subject for this class." });
      continue;
    }

    const resolvedComment = await resolveComment(req.schoolId, entry.mark, entry.comment);

    const record = await AssessmentRecord.findOneAndUpdate(
      { schoolId: req.schoolId, studentId: entry.studentId, subjectId, termId },
      { mark: entry.mark, comment: resolvedComment, enteredBy: req.user._id },
      { new: true, upsert: true }
    );
    results.push(record);
  }

  res.status(207).json({ saved: results.length, failed: errors.length, errors });
});

/**
 * GET /api/assessments/class/:subjectId/:streamId/:termId
 * All marks for a whole class, one subject, one term — the "gradebook
 * view" a teacher would actually look at.
 */
router.get("/class/:subjectId/:streamId/:termId", async (req, res) => {
  const { subjectId, streamId, termId } = req.params;

  const students = await Student.find({ schoolId: req.schoolId, streamId, status: "active" }).sort(
    "lastName firstName"
  );
  const records = await AssessmentRecord.find({
    schoolId: req.schoolId,
    subjectId,
    termId,
    studentId: { $in: students.map((s) => s._id) },
  });
  const recordByStudent = new Map(records.map((r) => [r.studentId.toString(), r]));

  const scheme = await MarkingScheme.findOne({ schoolId: req.schoolId, isDefault: true });

  const rows = students.map((s) => {
    const record = recordByStudent.get(s._id.toString());
    const band = record && scheme ? getBandForMark(record.mark, scheme.bands) : null;
    return {
      studentId: s._id,
      admissionNumber: s.admissionNumber,
      name: `${s.firstName} ${s.lastName}`,
      mark: record ? record.mark : null,
      band,
      comment: record ? record.comment : "",
    };
  });

  res.json(rows);
});

/**
 * GET /api/assessments/report/:studentId/:termId
 * Full report card data — every subject for this student's grade level,
 * each with its mark + CBC band. PDF rendering is a later phase; this
 * returns the complete, ready-to-render data.
 */
router.get("/report/:studentId/:termId", async (req, res) => {
  const { studentId, termId } = req.params;

  const student = await Student.findOne({ _id: studentId, schoolId: req.schoolId });
  if (!student) return res.status(404).json({ error: "Student not found." });

  const scheme = await MarkingScheme.findOne({ schoolId: req.schoolId, isDefault: true });
  if (!scheme) {
    return res.status(400).json({ error: "No marking scheme configured for this school yet." });
  }

  const subjects = await Subject.find({ schoolId: req.schoolId, gradeLevelId: student.gradeLevelId });

  const subjectReports = [];
  for (const subject of subjects) {
    const record = await AssessmentRecord.findOne({
      schoolId: req.schoolId,
      studentId,
      subjectId: subject._id,
      termId,
    });
    const band = record ? getBandForMark(record.mark, scheme.bands) : null;
    subjectReports.push({
      subjectId: subject._id,
      subjectName: subject.name,
      mark: record ? record.mark : null,
      band,
      comment: record ? record.comment : "",
    });
  }

  res.json({
    student: {
      id: student._id,
      admissionNumber: student.admissionNumber,
      name: `${student.firstName} ${student.lastName}`,
    },
    termId,
    subjects: subjectReports,
  });
});

module.exports = router;
