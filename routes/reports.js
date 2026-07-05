const express = require("express");
const School = require("../models/School");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const Stream = require("../models/Stream");
const Term = require("../models/Term");
const AssessmentRecord = require("../models/AssessmentRecord");
const MarkingScheme = require("../models/MarkingScheme");
const { getBandForMark, computeClassRanking } = require("../utils/cbcGradingEngine");
const { streamReportCardPDF, streamClassSheetPDF, streamClassRankingPDF } = require("../utils/pdfGenerator");
const { requireAuth, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

/**
 * GET /api/reports/student/:studentId/:termId/pdf
 * Downloads a CBC report card for one student for one term.
 */
router.get("/student/:studentId/:termId/pdf", async (req, res) => {
  const { studentId, termId } = req.params;

  const [school, student, term, scheme] = await Promise.all([
    School.findById(req.schoolId),
    Student.findOne({ _id: studentId, schoolId: req.schoolId }),
    Term.findOne({ _id: termId, schoolId: req.schoolId }),
    MarkingScheme.findOne({ schoolId: req.schoolId, isDefault: true }),
  ]);

  if (!student) return res.status(404).json({ error: "Student not found." });
  if (!term) return res.status(404).json({ error: "Term not found." });
  if (!scheme) return res.status(400).json({ error: "No marking scheme configured for this school yet." });

  const subjects = await Subject.find({ schoolId: req.schoolId, gradeLevelId: student.gradeLevelId });

  const subjectRows = [];
  for (const subject of subjects) {
    const record = await AssessmentRecord.findOne({
      schoolId: req.schoolId,
      studentId,
      subjectId: subject._id,
      termId,
    });
    subjectRows.push({
      subjectName: subject.name,
      mark: record ? record.mark : null,
      band: record ? getBandForMark(record.mark, scheme.bands) : null,
      comment: record ? record.comment : "",
    });
  }

  streamReportCardPDF(res, {
    school,
    student: { name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber },
    term: { name: term.name },
    subjects: subjectRows,
  });
});

/**
 * GET /api/reports/class/:subjectId/:streamId/:termId/pdf
 * Downloads a whole-class mark sheet for one subject/term.
 */
router.get("/class/:subjectId/:streamId/:termId/pdf", async (req, res) => {
  const { subjectId, streamId, termId } = req.params;

  const [school, subject, stream, term, scheme] = await Promise.all([
    School.findById(req.schoolId),
    Subject.findOne({ _id: subjectId, schoolId: req.schoolId }),
    Stream.findOne({ _id: streamId, schoolId: req.schoolId }),
    Term.findOne({ _id: termId, schoolId: req.schoolId }),
    MarkingScheme.findOne({ schoolId: req.schoolId, isDefault: true }),
  ]);

  if (!subject) return res.status(404).json({ error: "Subject not found." });
  if (!stream) return res.status(404).json({ error: "Stream not found." });
  if (!term) return res.status(404).json({ error: "Term not found." });
  if (!scheme) return res.status(400).json({ error: "No marking scheme configured for this school yet." });

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

  const rows = students.map((s) => {
    const record = recordByStudent.get(s._id.toString());
    return {
      admissionNumber: s.admissionNumber,
      name: `${s.firstName} ${s.lastName}`,
      mark: record ? record.mark : null,
      band: record ? getBandForMark(record.mark, scheme.bands) : null,
    };
  });

  streamClassSheetPDF(res, {
    school,
    subjectName: subject.name,
    streamName: stream.name,
    termName: term.name,
    rows,
  });
});

/**
 * Shared fetch + compute for class ranking — used by both the JSON and
 * PDF endpoints below so the two can never drift out of sync.
 */
async function fetchClassRanking(schoolId, streamId, termId) {
  const stream = await Stream.findOne({ _id: streamId, schoolId });
  if (!stream) return { error: "Stream not found." };

  const [students, subjects, scheme] = await Promise.all([
    Student.find({ schoolId, streamId, status: "active" }).sort("lastName firstName"),
    Subject.find({ schoolId, gradeLevelId: stream.gradeLevelId }),
    MarkingScheme.findOne({ schoolId, isDefault: true }),
  ]);
  if (!scheme) return { error: "No marking scheme configured for this school yet." };

  const records = await AssessmentRecord.find({
    schoolId,
    termId,
    studentId: { $in: students.map((s) => s._id) },
  });

  const recordsByStudent = new Map();
  for (const r of records) {
    const key = r.studentId.toString();
    if (!recordsByStudent.has(key)) recordsByStudent.set(key, []);
    recordsByStudent.get(key).push({ subjectId: r.subjectId.toString(), mark: r.mark });
  }

  const rankedRows = computeClassRanking(
    students.map((s) => ({ id: s._id.toString(), admissionNumber: s.admissionNumber, name: `${s.firstName} ${s.lastName}` })),
    subjects.map((s) => ({ id: s._id.toString(), name: s.name })),
    recordsByStudent,
    scheme.bands
  );

  return { stream, subjects, rows: rankedRows };
}

/**
 * GET /api/reports/class-ranking/:streamId/:termId
 * JSON version — position, mean mark, mean grade, and every subject's
 * mark for each student in the class. Open to teachers too (read-only),
 * not just school_admin.
 */
router.get("/class-ranking/:streamId/:termId", async (req, res) => {
  const { streamId, termId } = req.params;
  const result = await fetchClassRanking(req.schoolId, streamId, termId);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({
    stream: { id: result.stream._id, name: result.stream.name },
    subjects: result.subjects.map((s) => ({ id: s._id, name: s.name })),
    rows: result.rows,
  });
});

/**
 * GET /api/reports/class-ranking/:streamId/:termId/pdf
 * The full downloadable class ranking report — position, mean mark, mean
 * grade, per-subject marks. Open to teachers too, not just school_admin.
 */
router.get("/class-ranking/:streamId/:termId/pdf", async (req, res) => {
  const { streamId, termId } = req.params;
  const term = await Term.findOne({ _id: termId, schoolId: req.schoolId });
  if (!term) return res.status(404).json({ error: "Term not found." });

  const result = await fetchClassRanking(req.schoolId, streamId, termId);
  if (result.error) return res.status(400).json({ error: result.error });

  const school = await School.findById(req.schoolId);

  streamClassRankingPDF(res, {
    school,
    streamName: result.stream.name,
    termName: term.name,
    subjects: result.subjects.map((s) => ({ id: s._id.toString(), name: s.name })),
    rows: result.rows,
  });
});

module.exports = router;
