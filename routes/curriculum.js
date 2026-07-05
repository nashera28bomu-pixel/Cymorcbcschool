const express = require("express");
const GradeLevel = require("../models/GradeLevel");
const Stream = require("../models/Stream");
const Subject = require("../models/Subject");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

// ---------- Grade Levels ----------

router.post("/grade-levels", requireRole("school_admin"), async (req, res) => {
  const { name, educationLevel, order } = req.body;
  if (!name || !educationLevel) {
    return res.status(400).json({ error: "name and educationLevel are required." });
  }
  const gradeLevel = await GradeLevel.create({ schoolId: req.schoolId, name, educationLevel, order });
  res.status(201).json(gradeLevel);
});

router.get("/grade-levels", async (req, res) => {
  const gradeLevels = await GradeLevel.find({ schoolId: req.schoolId }).sort("order");
  res.json(gradeLevels);
});

// ---------- Streams ----------

router.post("/streams", requireRole("school_admin"), async (req, res) => {
  const { name, gradeLevelId, academicYearId, classTeacherId } = req.body;
  if (!name || !gradeLevelId || !academicYearId) {
    return res.status(400).json({ error: "name, gradeLevelId, and academicYearId are required." });
  }
  const stream = await Stream.create({
    schoolId: req.schoolId,
    name,
    gradeLevelId,
    academicYearId,
    classTeacherId: classTeacherId || null,
  });
  res.status(201).json(stream);
});

router.get("/streams", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  if (req.query.gradeLevelId) filter.gradeLevelId = req.query.gradeLevelId;
  const streams = await Stream.find(filter).populate("gradeLevelId", "name").populate("classTeacherId", "name");
  res.json(streams);
});

// ---------- Subjects ----------

router.post("/subjects", requireRole("school_admin"), async (req, res) => {
  const { name, code, gradeLevelId } = req.body;
  if (!name || !gradeLevelId) {
    return res.status(400).json({ error: "name and gradeLevelId are required." });
  }
  const subject = await Subject.create({ schoolId: req.schoolId, name, code, gradeLevelId });
  res.status(201).json(subject);
});

router.get("/subjects", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  if (req.query.gradeLevelId) filter.gradeLevelId = req.query.gradeLevelId;
  const subjects = await Subject.find(filter);
  res.json(subjects);
});

module.exports = router;
