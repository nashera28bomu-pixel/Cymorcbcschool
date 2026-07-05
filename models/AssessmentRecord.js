const mongoose = require("mongoose");

const assessmentRecordSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    termId: { type: mongoose.Schema.Types.ObjectId, ref: "Term", required: true },
    mark: { type: Number, required: true, min: 0, max: 100 },
    comment: { type: String, trim: true, default: "" },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One mark per student/subject/term — re-entering overwrites via upsert,
// rather than creating duplicate rows for the same assessment slot.
assessmentRecordSchema.index(
  { schoolId: 1, studentId: 1, subjectId: 1, termId: 1 },
  { unique: true }
);

module.exports = mongoose.model("AssessmentRecord", assessmentRecordSchema);
