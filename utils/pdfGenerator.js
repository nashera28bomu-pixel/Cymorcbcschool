const PDFDocument = require("pdfkit");

const BAND_COLORS = {
  EE: "#1F7A5C",
  ME: "#2563EB",
  AE: "#D97706",
  BE: "#DC2626",
};

/**
 * Streams a CBC report card PDF directly to the response.
 * data: { school, student: {name, admissionNumber}, term: {name}, subjects: [{subjectName, mark, band, comment}] }
 */
function streamReportCardPDF(res, data) {
  const { school, student, term, subjects } = data;
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-card-${student.admissionNumber}.pdf"`);
  doc.pipe(res);

  // ---- Header ----
  doc.fontSize(18).font("Helvetica-Bold").fillColor("#111").text(school.name, { align: "center" });
  const location = [school.subCounty, school.county].filter(Boolean).join(", ");
  if (location) {
    doc.fontSize(10).font("Helvetica").fillColor("#555").text(location, { align: "center" });
  }
  doc.moveDown(0.6);
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#111")
    .text("COMPETENCY-BASED CURRICULUM — LEARNER PROGRESS REPORT", { align: "center" });
  doc.moveDown(1.2);

  // ---- Student info ----
  doc.fontSize(11).font("Helvetica").fillColor("#111");
  doc.text(`Name: ${student.name}`);
  doc.text(`Admission No: ${student.admissionNumber}`);
  doc.text(`Term: ${term.name || ""}`);
  doc.moveDown(1);

  // ---- Table ----
  const colSubject = 50;
  const colMark = 300;
  const colRating = 360;
  const colComment = 430;
  const tableRight = 545;

  const tableTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Subject", colSubject, tableTop);
  doc.text("Mark", colMark, tableTop);
  doc.text("Rating", colRating, tableTop);
  doc.text("Comment", colComment, tableTop);
  doc
    .moveTo(colSubject, tableTop + 14)
    .lineTo(tableRight, tableTop + 14)
    .strokeColor("#999")
    .stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(10);

  subjects.forEach((s) => {
    if (y > 730) {
      doc.addPage();
      y = 50;
    }
    const bandCode = s.band ? s.band.code : "-";
    const bandColor = BAND_COLORS[bandCode] || "#111";

    doc.fillColor("#111").text(s.subjectName, colSubject, y, { width: colMark - colSubject - 10 });
    doc.text(s.mark !== null && s.mark !== undefined ? String(s.mark) : "-", colMark, y);
    doc.fillColor(bandColor).font("Helvetica-Bold").text(bandCode, colRating, y);
    doc.fillColor("#111").font("Helvetica").text(s.comment || "-", colComment, y, { width: tableRight - colComment });

    // Row height grows if the comment wraps to multiple lines.
    const commentHeight = doc.heightOfString(s.comment || "-", { width: tableRight - colComment });
    y += Math.max(20, commentHeight + 6);
  });

  // ---- Rating key ----
  doc.moveDown(2);
  if (doc.y > 700) doc.addPage();
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#111").text("Rating Key:", 50, doc.y);
  doc.font("Helvetica").fontSize(9);
  doc.fillColor(BAND_COLORS.EE).text("EE — Exceeding Expectation   ", { continued: true });
  doc.fillColor(BAND_COLORS.ME).text("ME — Meeting Expectation   ", { continued: true });
  doc.fillColor(BAND_COLORS.AE).text("AE — Approaching Expectation   ", { continued: true });
  doc.fillColor(BAND_COLORS.BE).text("BE — Below Expectation");

  // ---- Signature footer ----
  doc.moveDown(3);
  const footerY = doc.y;
  doc.fillColor("#111").fontSize(10);
  doc.text("Class Teacher's Signature: ____________________________", 50, footerY);
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 400, footerY);

  doc.end();
}

/**
 * Streams a class mark sheet PDF — one subject, one stream, one term,
 * every student's mark/rating in a single table. Useful for moderation
 * and record-keeping, not for handing to individual learners.
 */
function streamClassSheetPDF(res, data) {
  const { school, subjectName, streamName, termName, rows } = data;
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="class-sheet-${streamName}-${subjectName}.pdf"`.replace(/\s+/g, "-")
  );
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").fillColor("#111").text(school.name, { align: "center" });
  doc.moveDown(0.4);
  doc
    .fontSize(12)
    .font("Helvetica")
    .text(`${subjectName} — ${streamName} — ${termName}`, { align: "center" });
  doc.moveDown(1);

  const colAdm = 50;
  const colName = 130;
  const colMark = 350;
  const colRating = 420;
  const colComment = 480;
  const tableRight = 545;

  const tableTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Adm No", colAdm, tableTop);
  doc.text("Name", colName, tableTop);
  doc.text("Mark", colMark, tableTop);
  doc.text("Rating", colRating, tableTop);
  doc
    .moveTo(colAdm, tableTop + 14)
    .lineTo(tableRight, tableTop + 14)
    .strokeColor("#999")
    .stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(10);

  rows.forEach((r) => {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    const bandCode = r.band ? r.band.code : "-";
    const bandColor = BAND_COLORS[bandCode] || "#111";

    doc.fillColor("#111").text(r.admissionNumber, colAdm, y);
    doc.text(r.name, colName, y, { width: colMark - colName - 10 });
    doc.text(r.mark !== null ? String(r.mark) : "-", colMark, y);
    doc.fillColor(bandColor).font("Helvetica-Bold").text(bandCode, colRating, y);
    doc.fillColor("#111").font("Helvetica");
    y += 18;
  });

  doc.end();
}

/**
 * Streams a full class ranking report — every student's per-subject
 * marks, total, mean mark, mean grade (CBC band), and class position.
 * Landscape orientation since the subject columns are dynamic in number.
 */
function streamClassRankingPDF(res, data) {
  const { school, streamName, termName, subjects, rows } = data;
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="class-ranking-${streamName}-${termName}.pdf"`.replace(/\s+/g, "-")
  );
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").fillColor("#111").text(school.name, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).font("Helvetica").text(`Class Ranking Report — ${streamName} — ${termName}`, { align: "center" });
  doc.moveDown(1);

  const pageLeft = 40;
  const pageRight = 802; // A4 landscape usable width with 40pt margins (842 - 40)
  const colPosition = pageLeft;
  const colAdm = colPosition + 30;
  const colName = colAdm + 55;
  const subjectsStart = colName + 110;
  const fixedTailWidth = 45 + 45 + 40; // total, mean, grade
  const subjectAreaWidth = pageRight - subjectsStart - fixedTailWidth;
  const subjectColWidth = subjects.length > 0 ? subjectAreaWidth / subjects.length : 0;
  const colTotal = subjectsStart + subjects.length * subjectColWidth;
  const colMean = colTotal + 45;
  const colGrade = colMean + 45;

  const subjectFontSize = subjects.length > 10 ? 6.5 : 8;

  function drawHeader(y) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111");
    doc.text("Pos", colPosition, y, { width: 26 });
    doc.text("Adm", colAdm, y, { width: 50 });
    doc.text("Name", colName, y, { width: 105 });
    subjects.forEach((subj, i) => {
      doc.fontSize(subjectFontSize).text(subj.name.slice(0, 10), subjectsStart + i * subjectColWidth, y, {
        width: subjectColWidth - 2,
      });
    });
    doc.fontSize(8);
    doc.text("Total", colTotal, y, { width: 40 });
    doc.text("Mean", colMean, y, { width: 40 });
    doc.text("Grade", colGrade, y, { width: 40 });
    doc
      .moveTo(pageLeft, y + 12)
      .lineTo(pageRight, y + 12)
      .strokeColor("#999")
      .stroke();
  }

  let y = doc.y;
  drawHeader(y);
  y += 18;

  doc.font("Helvetica").fontSize(8);
  rows.forEach((r) => {
    if (y > 540) {
      doc.addPage();
      y = 40;
      drawHeader(y);
      y += 18;
    }

    doc.fillColor("#111");
    doc.text(r.position !== null ? String(r.position) : "-", colPosition, y, { width: 26 });
    doc.text(r.admissionNumber, colAdm, y, { width: 50 });
    doc.text(r.name, colName, y, { width: 105 });

    r.marks.forEach((m, i) => {
      doc
        .fontSize(subjectFontSize)
        .text(m.mark !== null ? String(m.mark) : "-", subjectsStart + i * subjectColWidth, y, {
          width: subjectColWidth - 2,
        });
    });

    doc.fontSize(8);
    doc.text(r.total !== null ? String(r.total) : "-", colTotal, y, { width: 40 });
    doc.text(r.meanMark !== null ? String(r.meanMark) : "-", colMean, y, { width: 40 });
    if (r.meanGrade) {
      doc.fillColor(BAND_COLORS[r.meanGrade.code] || "#111").font("Helvetica-Bold");
      doc.text(r.meanGrade.code, colGrade, y, { width: 40 });
      doc.font("Helvetica").fillColor("#111");
    } else {
      doc.text("-", colGrade, y, { width: 40 });
    }

    y += 16;
  });

  doc.end();
}

module.exports = { streamReportCardPDF, streamClassSheetPDF, streamClassRankingPDF };
