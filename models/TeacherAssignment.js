const mongoose = require("mongoose");

const teacherAssignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    streamId: { type: mongoose.Schema.Types.ObjectId, ref: "Stream", required: true },
  },
  { timestamps: true }
);

teacherAssignmentSchema.index({ schoolId: 1, teacherId: 1, subjectId: 1, streamId: 1 }, { unique: true });

module.exports = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
