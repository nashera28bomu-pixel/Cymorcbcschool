const express = require("express");
const TeacherAssignment = require("../models/TeacherAssignment");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

router.post("/", requireRole("school_admin"), async (req, res) => {
  const { teacherId, subjectId, streamId } = req.body;
  if (!teacherId || !subjectId || !streamId) {
    return res.status(400).json({ error: "teacherId, subjectId, and streamId are required." });
  }

  const existing = await TeacherAssignment.findOne({ schoolId: req.schoolId, teacherId, subjectId, streamId });
  if (existing) return res.status(409).json({ error: "This assignment already exists." });

  const assignment = await TeacherAssignment.create({ schoolId: req.schoolId, teacherId, subjectId, streamId });
  res.status(201).json(assignment);
});

router.get("/", async (req, res) => {
  const filter = { schoolId: req.schoolId };
  // Teachers can only see their own assignments; admins can see everyone's
  // (or filter by teacherId via query for a specific teacher).
  if (req.user.role === "teacher") {
    filter.teacherId = req.user._id;
  } else if (req.query.teacherId) {
    filter.teacherId = req.query.teacherId;
  }

  const assignments = await TeacherAssignment.find(filter)
    .populate("subjectId", "name")
    .populate("streamId", "name")
    .populate("teacherId", "name");
  res.json(assignments);
});

router.delete("/:id", requireRole("school_admin"), async (req, res) => {
  const result = await TeacherAssignment.findOneAndDelete({ _id: req.params.id, schoolId: req.schoolId });
  if (!result) return res.status(404).json({ error: "Assignment not found." });
  res.status(204).send();
});

module.exports = router;
