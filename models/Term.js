const mongoose = require("mongoose");

const termSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Term 1"
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Term", termSchema);
