/**
 * Core CBC rating logic. Kept as pure functions (no DB access) so they're
 * easy to unit test independently of Express/Mongoose.
 */

/**
 * Finds which band a mark falls into, given a school's configured bands.
 * Returns null if no band matches (e.g. bands don't cover 0-100 fully —
 * worth surfacing as a data problem rather than silently picking one).
 */
function getBandForMark(mark, bands) {
  if (typeof mark !== "number" || Number.isNaN(mark)) return null;
  return bands.find((b) => mark >= b.minPercent && mark <= b.maxPercent) || null;
}

/**
 * Validates that a set of bands sensibly covers 0-100 with no gaps/overlaps.
 * Used when a school edits their marking scheme, to catch config mistakes
 * before they silently produce "no band matched" results during grading.
 */
function validateBands(bands) {
  const errors = [];
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);

  if (sorted.length === 0) {
    errors.push("At least one band is required.");
    return errors;
  }

  if (sorted[0].minPercent > 0) {
    errors.push(`Bands don't cover marks below ${sorted[0].minPercent}%.`);
  }
  if (sorted[sorted.length - 1].maxPercent < 100) {
    errors.push(`Bands don't cover marks above ${sorted[sorted.length - 1].maxPercent}%.`);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.maxPercent >= next.minPercent) {
      errors.push(
        `"${current.label}" (up to ${current.maxPercent}%) overlaps with "${next.label}" (from ${next.minPercent}%).`
      );
    } else if (current.maxPercent + 1 < next.minPercent) {
      errors.push(
        `Gap between "${current.label}" (up to ${current.maxPercent}%) and "${next.label}" (from ${next.minPercent}%) — marks in between would match no band.`
      );
    }
  }

  return errors;
}

/**
 * Computes a class ranking: total marks, mean mark, mean grade (CBC band),
 * and position for every student in a stream/term, across all subjects.
 * Pure function — takes already-loaded data so it's testable without a DB.
 *
 * @param {Array<{id, admissionNumber, name}>} students
 * @param {Array<{id, name}>} subjects
 * @param {Map<string, Array<{subjectId, mark}>>} recordsByStudent - keyed by student.id
 * @param {Array} bands
 */
function computeClassRanking(students, subjects, recordsByStudent, bands) {
  const rows = students.map((student) => {
    const records = recordsByStudent.get(student.id) || [];
    const recordBySubject = new Map(records.map((r) => [r.subjectId, r]));

    const marks = subjects.map((subj) => {
      const rec = recordBySubject.get(subj.id);
      return { subjectId: subj.id, subjectName: subj.name, mark: rec ? rec.mark : null };
    });

    const validMarks = marks.filter((m) => m.mark !== null).map((m) => m.mark);
    const total = round1(validMarks.reduce((sum, m) => sum + m, 0));
    const meanMark = validMarks.length ? round1(total / validMarks.length) : null;
    const meanGrade = meanMark !== null ? getBandForMark(meanMark, bands) : null;

    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      name: student.name,
      marks,
      total,
      meanMark,
      meanGrade,
      subjectsGraded: validMarks.length,
      position: null, // filled in below
    };
  });

  // Students with no marks at all can't be meaningfully ranked — they're
  // listed but excluded from the position sequence, not silently dropped.
  const ranked = rows.filter((r) => r.meanMark !== null).sort((a, b) => b.meanMark - a.meanMark);
  const unranked = rows.filter((r) => r.meanMark === null);

  // Standard competition ranking: equal mean marks share the same
  // position, and the next distinct position skips accordingly
  // (e.g. 1, 2, 2, 4 — not 1, 2, 2, 3).
  let position = 0;
  let previousMean = null;
  ranked.forEach((r, i) => {
    if (r.meanMark !== previousMean) {
      position = i + 1;
      previousMean = r.meanMark;
    }
    r.position = position;
  });

  return [...ranked, ...unranked];
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = { getBandForMark, validateBands, computeClassRanking };
