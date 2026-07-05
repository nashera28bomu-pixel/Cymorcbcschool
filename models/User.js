const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // null only for super_admin (the Cymor-level operator of the whole SaaS)
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "school_admin", "teacher"],
      required: true,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Email is unique across the WHOLE platform, not just per school — login
// looks up by email alone with no school context, so per-school uniqueness
// would make that lookup ambiguous if the same email existed at two schools.
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
