const express = require("express");
const MarkingScheme = require("../models/MarkingScheme");
const { validateBands } = require("../utils/cbcGradingEngine");
const { requireAuth, requireRole, requireSchoolContext } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireSchoolContext);

router.get("/", async (req, res) => {
  const scheme = await MarkingScheme.findOne({ schoolId: req.schoolId, isDefault: true });
  res.json(scheme);
});

// PUT rather than PATCH — a marking scheme's bands are edited as a whole
// set, since gap/overlap validation only makes sense against the complete
// picture, not one band in isolation.
router.put("/", requireRole("school_admin"), async (req, res) => {
  const { bands } = req.body;
  if (!Array.isArray(bands) || bands.length === 0) {
    return res.status(400).json({ error: "bands must be a non-empty array." });
  }

  const errors = validateBands(bands);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Invalid marking scheme.", details: errors });
  }

  const scheme = await MarkingScheme.findOneAndUpdate(
    { schoolId: req.schoolId, isDefault: true },
    { bands },
    { new: true, upsert: true }
  );
  res.json(scheme);
});

module.exports = router;
