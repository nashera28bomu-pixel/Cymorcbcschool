const mongoose = require("mongoose");

const streamSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    gradeLevelId: { type: mongoose.Schema.Types.ObjectId, ref: "GradeLevel", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Blue", "East", or just "A"
    classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Stream", streamSchema);
