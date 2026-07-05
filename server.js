require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff");
const curriculumRoutes = require("./routes/curriculum");
const studentRoutes = require("./routes/students");
const academicsRoutes = require("./routes/academics");
const markingSchemeRoutes = require("./routes/markingScheme");
const teacherAssignmentRoutes = require("./routes/teacherAssignments");
const assessmentRoutes = require("./routes/assessments");
const reportRoutes = require("./routes/reports");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(express.static("public"));

// Basic protection against brute-force login attempts / abuse — generous
// enough for normal school use, tight enough to slow down attackers.
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/curriculum", curriculumRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/academics", academicsRoutes);
app.use("/api/marking-scheme", markingSchemeRoutes);
app.use("/api/teacher-assignments", teacherAssignmentRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/reports", reportRoutes);

// Global error handler — turns any unhandled error into a readable JSON
// message instead of a bare, undebuggable 500.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: `${err.name}: ${err.message}` });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Cymor School CBC API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
