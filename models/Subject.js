const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "Mathematics"
    code: { type: String, trim: true },
    gradeLevelId: { type: mongoose.Schema.Types.ObjectId, ref: "GradeLevel", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);
