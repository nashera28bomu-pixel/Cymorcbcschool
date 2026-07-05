const mongoose = require("mongoose");

const bandSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true }, // "EE" | "ME" | "AE" | "BE"
    label: { type: String, required: true, trim: true }, // "Exceeding Expectation"
    minPercent: { type: Number, required: true },
    maxPercent: { type: Number, required: true },
    defaultComment: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const markingSchemeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true, default: "Default CBC Marking Scheme" },
    bands: { type: [bandSchema], required: true },
    isDefault: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Verified against KNEC's own published CBC grading table (not guessed) —
// see README for the source. Schools can edit these thresholds freely;
// this is only the starting default seeded when a school signs up.
const OFFICIAL_KNEC_DEFAULT_BANDS = [
  {
    code: "EE",
    label: "Exceeding Expectation",
    minPercent: 75,
    maxPercent: 100,
    defaultComment: "Exceeds expectations. Keep up the excellent work.",
  },
  {
    code: "ME",
    label: "Meeting Expectation",
    minPercent: 41,
    maxPercent: 74,
    defaultComment: "Meets expectations. Good, consistent progress.",
  },
  {
    code: "AE",
    label: "Approaching Expectation",
    minPercent: 21,
    maxPercent: 40,
    defaultComment: "Approaching expectations. Needs more practice.",
  },
  {
    code: "BE",
    label: "Below Expectation",
    minPercent: 0,
    maxPercent: 20,
    defaultComment: "Below expectations. Requires targeted support.",
  },
];

markingSchemeSchema.statics.OFFICIAL_KNEC_DEFAULT_BANDS = OFFICIAL_KNEC_DEFAULT_BANDS;

module.exports = mongoose.model("MarkingScheme", markingSchemeSchema);
