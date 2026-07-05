const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

// POST /api/staff — school_admin creates a teacher account
router.post("/", requireRole("school_admin"), async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const teacher = await User.create({
    schoolId: req.schoolId,
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "teacher",
    phone,
  });

  res.status(201).json({
    id: teacher._id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    isActive: teacher.isActive,
  });
});

// GET /api/staff — list all staff at this school
router.get("/", requireRole("school_admin"), async (req, res) => {
  const staff = await User.find({ schoolId: req.schoolId, role: "teacher" }).select("-passwordHash");
  res.json(staff);
});

// PATCH /api/staff/:id — deactivate/reactivate a teacher account
router.patch("/:id", requireRole("school_admin"), async (req, res) => {
  const { isActive } = req.body;
  const teacher = await User.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.schoolId, role: "teacher" },
    { isActive },
    { new: true }
  ).select("-passwordHash");

  if (!teacher) return res.status(404).json({ error: "Teacher not found." });
  res.json(teacher);
});

module.exports = router;
