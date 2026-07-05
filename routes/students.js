const express = require("express");
const Student = require("../models/Student");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

router.post("/", requireRole("school_admin"), async (req, res) => {
  const {
    admissionNumber,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    gradeLevelId,
    streamId,
    guardianName,
    guardianPhone,
  } = req.body;

  if (!admissionNumber || !firstName || !lastName || !gradeLevelId || !streamId) {
    return res.status(400).json({
      error: "admissionNumber, firstName, lastName, gradeLevelId, and streamId are required.",
    });
  }

  const existing = await Student.findOne({ schoolId: req.schoolId, admissionNumber });
  if (existing) {
    return res.status(409).json({ error: `Admission number ${admissionNumber} is already in use at this school.` });
  }

  const student = await Student.create({
    schoolId: req.schoolId,
    admissionNumber,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    gradeLevelId,
    streamId,
    guardianName,
    guardianPhone,
  });

  res.status(201).json(student);
});

router.get("/", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  if (req.query.streamId) filter.streamId = req.query.streamId;
  if (req.query.gradeLevelId) filter.gradeLevelId = req.query.gradeLevelId;
  if (req.query.status) filter.status = req.query.status;

  const students = await Student.find(filter)
    .populate("gradeLevelId", "name")
    .populate("streamId", "name")
    .sort("lastName firstName");
  res.json(students);
});

router.get("/:id", async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, schoolId: req.schoolId })
    .populate("gradeLevelId", "name")
    .populate("streamId", "name");
  if (!student) return res.status(404).json({ error: "Student not found." });
  res.json(student);
});

router.patch("/:id", requireRole("school_admin"), async (req, res) => {
  const allowedFields = [
    "firstName",
    "lastName",
    "dateOfBirth",
    "gender",
    "gradeLevelId",
    "streamId",
    "guardianName",
    "guardianPhone",
    "status",
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const student = await Student.findOneAndUpdate({ _id: req.params.id, schoolId: req.schoolId }, updates, {
    new: true,
  });
  if (!student) return res.status(404).json({ error: "Student not found." });
  res.json(student);
});

module.exports = router;
