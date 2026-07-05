const express = require("express");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

router.post("/academic-years", requireRole("school_admin"), async (req, res) => {
  const { name, isCurrent } = req.body;
  if (!name) return res.status(400).json({ error: "name is required." });

  if (isCurrent) {
    await AcademicYear.updateMany({ schoolId: req.schoolId }, { isCurrent: false });
  }
  const year = await AcademicYear.create({ schoolId: req.schoolId, name, isCurrent: !!isCurrent });
  res.status(201).json(year);
});

router.get("/academic-years", async (req, res) => {
  const years = await AcademicYear.find({ schoolId: req.schoolId }).sort("-name");
  res.json(years);
});

router.post("/terms", requireRole("school_admin"), async (req, res) => {
  const { academicYearId, name, startDate, endDate, isCurrent } = req.body;
  if (!academicYearId || !name) {
    return res.status(400).json({ error: "academicYearId and name are required." });
  }

  if (isCurrent) {
    await Term.updateMany({ schoolId: req.schoolId }, { isCurrent: false });
  }
  const term = await Term.create({
    schoolId: req.schoolId,
    academicYearId,
    name,
    startDate,
    endDate,
    isCurrent: !!isCurrent,
  });
  res.status(201).json(term);
});

router.get("/terms", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  if (req.query.academicYearId) filter.academicYearId = req.query.academicYearId;
  const terms = await Term.find(filter).sort("-startDate");
  res.json(terms);
});

module.exports = router;
