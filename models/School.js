const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    county: { type: String, trim: true },
    subCounty: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    status: {
      type: String,
      enum: ["trial", "active", "suspended"],
      default: "trial",
    },
    // Placeholder for future billing — not used yet, but avoids a migration later.
    subscriptionPlan: { type: String, default: "trial" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);
