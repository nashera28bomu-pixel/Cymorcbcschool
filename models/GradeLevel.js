const mongoose = require("mongoose");

const gradeLevelSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "Grade 4", "PP1"
    educationLevel: {
      type: String,
      enum: ["pre-primary", "lower-primary", "upper-primary", "junior-school", "senior-school"],
      required: true,
    },
    order: { type: Number, default: 0 }, // for sorting PP1 < PP2 < Grade 1 < ...
  },
  { timestamps: true }
);

gradeLevelSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("GradeLevel", gradeLevelSchema);
