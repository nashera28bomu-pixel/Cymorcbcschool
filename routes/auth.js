const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const School = require("../models/School");
const User = require("../models/User");
const MarkingScheme = require("../models/MarkingScheme");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, schoolId: user.schoolId ? user.schoolId.toString() : null },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

/**
 * POST /api/auth/register-school
 * Creates a new school (tenant), its first school_admin user, and seeds a
 * default marking scheme using the verified official KNEC bands — the
 * school can edit these thresholds afterwards from Settings.
 */
router.post("/register-school", async (req, res) => {
  const { schoolName, county, subCounty, adminName, adminEmail, adminPassword, adminPhone } = req.body;

  if (!schoolName || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({
      error: "schoolName, adminName, adminEmail, and adminPassword are required.",
    });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const existing = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const school = await School.create({
    name: schoolName,
    county,
    subCounty,
    contactEmail: adminEmail.toLowerCase(),
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await User.create({
    schoolId: school._id,
    name: adminName,
    email: adminEmail.toLowerCase(),
    passwordHash,
    role: "school_admin",
    phone: adminPhone,
  });

  await MarkingScheme.create({
    schoolId: school._id,
    name: "Default CBC Marking Scheme",
    bands: MarkingScheme.OFFICIAL_KNEC_DEFAULT_BANDS,
    isDefault: true,
  });

  const token = signToken(admin);
  res.status(201).json({
    token,
    user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    school: { id: school._id, name: school.name },
  });
});

/**
 * POST /api/auth/login
 * Works for any role (super_admin, school_admin, teacher) — the token
 * carries the role and schoolId, and every downstream route checks both.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, schoolId: user.schoolId },
  });
});

module.exports = router;
