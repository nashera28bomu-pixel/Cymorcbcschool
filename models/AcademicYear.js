const mongoose = require("mongoose");

const academicYearSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "2026"
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicYearSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("AcademicYear", academicYearSchema);
