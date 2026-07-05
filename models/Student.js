const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    admissionNumber: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female"] },
    gradeLevelId: { type: mongoose.Schema.Types.ObjectId, ref: "GradeLevel", required: true },
    streamId: { type: mongoose.Schema.Types.ObjectId, ref: "Stream", required: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "transferred", "graduated"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Admission number unique per school, not globally.
studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
