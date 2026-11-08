import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * The KnowBuild 2.0 certificate, drawn to match
 * certificate-templates/knowbuild-certificate.html.
 *
 * A separate template from generate.ts's, not a variant of it — KnowBuild is a
 * team hackathon (name AND team name on the blank, its own dino badge, its own
 * date/copy), and the workshop certificate stays exactly as it was for events
 * that still use it. See generate.ts for the general notes on why this is
 * redrawn as vector rather than screenshotted, and on the Old English/Times
 * font substitutions.
 */

const ASSETS = path.join(process.cwd(), "src/lib/certificates/assets");

const PAGE = { width: 1200, height: 800 };
const PAD = { top: 25, right: 55, bottom: 55, left: 35 };

const CONTENT_LEFT = PAD.left;
const CONTENT_RIGHT = PAGE.width - PAD.right;
const CENTER_X = (CONTENT_LEFT + CONTENT_RIGHT) / 2;

const MAROON = rgb(0xae / 255, 0x0d / 255, 0x2e / 255);
const RED = rgb(1, 0, 0);
const BLACK = rgb(0, 0, 0);

/** .participant-line / .team-line — the blanks the name and team are written on. */
const NAME_LINE = { width: 480, borderWidth: 1.4 };

const fromTop = (y: number) => PAGE.height - y;

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont; title: PDFFont };

export async function generateKnowbuildCertificatePdf(
  participantName: string,
  teamName: string,
  options: { dateText?: string } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  const ctx: Ctx = {
    page,
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    title: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: rgb(1, 1, 1),
  });

  page.drawRectangle({
    x: PAGE.width - 30,
    y: 0,
    width: 30,
    height: PAGE.height - 185,
    color: MAROON,
  });

  page.drawRectangle({ x: 0, y: 0, width: PAGE.width * 0.22, height: 30, color: RED });
  page.drawRectangle({
    x: PAGE.width * 0.22,
    y: 0,
    width: PAGE.width * 0.78,
    height: 30,
    color: MAROON,
  });

  await drawLogos(pdf, page);

  // .event-badge — 14px below the logo row, the KnowBuild 2.0 mark.
  const badgeTop = PAD.top + 112 + 14;
  const logoHeight = await drawImage(pdf, page, "kb2-logo2.png", {
    x: CENTER_X - 170,
    top: badgeTop,
    width: 340,
    height: 157,
    align: "center-top",
  });

  // .certificate-title — 20px below the logo, 52px, centred.
  const titleTop = badgeTop + logoHeight + 20;
  drawCentered(ctx, ctx.title, "Certificate of Participation", {
    size: 52,
    lineHeight: 52,
    top: titleTop,
    centerX: CENTER_X,
  });

  const bodyTop = titleTop + 52 + 34;
  drawBody(ctx, participantName, teamName, bodyTop, options);

  await drawSignatures(pdf, ctx);

  return pdf.save();
}

/** .certificate-content — the prose, with the participant and team names written on their blanks. */
function drawBody(
  ctx: Ctx,
  participantName: string,
  teamName: string,
  top: number,
  options: { dateText?: string },
) {
  const size = 24;
  const lineHeight = size * 1.4;

  // .first-line — "This is to certify that Mr./Ms. ____ of team"
  const lead = "This is to certify that Mr./Ms.";
  const tail = "of team";
  const gap = 6;

  const leadWidth = ctx.regular.widthOfTextAtSize(lead, size);
  const tailWidth = ctx.regular.widthOfTextAtSize(tail, size);
  const rowWidth = leadWidth + gap + NAME_LINE.width + gap + tailWidth;
  const rowLeft = CENTER_X - rowWidth / 2;

  const firstBaseline = baselineFor(ctx.regular, size, lineHeight, top);

  ctx.page.drawText(lead, { x: rowLeft, y: fromTop(firstBaseline), size, font: ctx.regular });
  ctx.page.drawText(tail, {
    x: rowLeft + leadWidth + gap + NAME_LINE.width + gap,
    y: fromTop(firstBaseline),
    size,
    font: ctx.regular,
  });

  const nameLineLeft = rowLeft + leadWidth + gap;
  drawBlankAndName(ctx, participantName, nameLineLeft, firstBaseline, size, NAME_LINE.width);

  // .second-line — the team blank followed by the "student of ..." tail, on
  // one line so it can't run long enough to collide with the signatures.
  const secondSize = 21;
  const secondLineHeight = secondSize * 1.4;
  const teamLineWidth = 260;
  const secondTail = ", a student of K J Somaiya Institute of Technology,";
  const secondTop = top + lineHeight + 10;
  const secondBaseline = baselineFor(ctx.regular, secondSize, secondLineHeight, secondTop);

  const tailWidth2 = ctx.regular.widthOfTextAtSize(secondTail, secondSize);
  const secondRowWidth = teamLineWidth + gap + tailWidth2;
  const secondRowLeft = CENTER_X - secondRowWidth / 2;

  drawBlankAndName(ctx, teamName, secondRowLeft, secondBaseline, secondSize, teamLineWidth);
  ctx.page.drawText(secondTail, {
    x: secondRowLeft + teamLineWidth + gap,
    y: fromTop(secondBaseline),
    size: secondSize,
    font: ctx.regular,
  });

  // The paragraphs below. Adjacent <p> margins collapse to a single 3px.
  let y = secondTop + secondLineHeight + 3;
  y = drawParagraph(ctx, y, size, [{ text: "has successfully participated in" }]);

  y = drawParagraph(ctx, y + 3, 25, [
    { text: "“KnowBuild 2.0”", bold: true },
    { text: ", a hackathon organized by the" },
  ]);

  const dateText = options.dateText?.trim() || "held on 26th September 2026.";
  drawParagraph(ctx, y + 3, 25, [
    { text: "Society for Data Science, KJSIT Students Chapter,", bold: true },
    { text: ` ${dateText}` },
  ]);
}

/** Draws the rule and, if given, the name centred on it — shared by the
 * participant and team blanks. */
function drawBlankAndName(
  ctx: Ctx,
  text: string,
  lineLeft: number,
  baseline: number,
  size: number,
  lineWidth: number,
) {
  ctx.page.drawRectangle({
    x: lineLeft,
    y: fromTop(baseline) - NAME_LINE.borderWidth,
    width: lineWidth,
    height: NAME_LINE.borderWidth,
    color: BLACK,
  });

  const name = text.trim();
  if (!name) return;

  const maxWidth = lineWidth - 16;
  let fontSize = size;
  while (ctx.regular.widthOfTextAtSize(name, fontSize) > maxWidth && fontSize > size * 0.6) {
    fontSize -= 0.5;
  }

  const width = ctx.regular.widthOfTextAtSize(name, fontSize);
  ctx.page.drawText(name, {
    x: lineLeft + (lineWidth - width) / 2,
    // Lifted well clear of the rule — at +3 (generate.ts's single-blank
    // offset) the name and team lines sit close enough to their rules to read
    // as touching when the two blanks stack right on top of each other.
    y: fromTop(baseline) + 8,
    size: fontSize,
    font: ctx.regular,
    color: BLACK,
  });
}

function drawParagraph(
  ctx: Ctx,
  top: number,
  size: number,
  runs: { text: string; bold?: boolean }[],
) {
  const lineHeight = size * 1.4;
  drawRuns(ctx, top, size, lineHeight, runs);
  return top + lineHeight;
}

function drawRuns(
  ctx: Ctx,
  top: number,
  size: number,
  lineHeight: number,
  runs: { text: string; bold?: boolean }[],
) {
  const widths = runs.map((run) =>
    (run.bold ? ctx.bold : ctx.regular).widthOfTextAtSize(run.text, size),
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  const baseline = baselineFor(ctx.regular, size, lineHeight, top);

  let x = CENTER_X - total / 2;
  runs.forEach((run, index) => {
    ctx.page.drawText(run.text, {
      x,
      y: fromTop(baseline),
      size,
      font: run.bold ? ctx.bold : ctx.regular,
      color: BLACK,
    });
    x += widths[index];
  });
}

function drawCentered(
  ctx: Ctx,
  font: PDFFont,
  text: string,
  box: { size: number; lineHeight: number; top: number; centerX: number },
) {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, box.size);
  ctx.page.drawText(text, {
    x: box.centerX - width / 2,
    y: fromTop(baselineFor(font, box.size, box.lineHeight, box.top)),
    size: box.size,
    font,
    color: BLACK,
  });
}

function baselineFor(font: PDFFont, size: number, lineHeight: number, top: number) {
  const ascent = font.heightAtSize(size, { descender: false });
  const halfLeading = (lineHeight - font.heightAtSize(size)) / 2;
  return top + halfLeading + ascent;
}

/** .top-section — Somaiya on the left, the two chapter marks on the right. */
async function drawLogos(pdf: PDFDocument, page: PDFPage) {
  await drawImage(pdf, page, "somaiya-logo.png", {
    x: CONTENT_LEFT,
    top: PAD.top,
    width: 350,
    height: 105,
    align: "left",
  });

  await drawImage(pdf, page, "sds.png", {
    x: CONTENT_RIGHT - 112,
    top: PAD.top,
    width: 112,
    height: 112,
  });
  await drawImage(pdf, page, "s4ds-logo.png", {
    x: CONTENT_RIGHT - 112 - 18 - 112,
    top: PAD.top,
    width: 112,
    height: 112,
  });
}

const SIGNATORIES = [
  { file: "princi.png", name: "Dr. Vivek Sunnapwar", role: "Principal", height: 95 },
  { file: "nemade.png", name: "Dr. Milind U. Nemade", role: "Faculty Convener", height: 95 },
  { file: "sejal.png", name: "Prof. Sejal Shah", role: "Faculty Coordinator", height: 92 },
  { file: "dbhate.png", name: "Prof. Devanand Bathe", role: "Faculty Coordinator", height: 88 },
];

/** .signatures — four boxes, space-between, pinned 47px off the bottom. */
async function drawSignatures(pdf: PDFDocument, ctx: Ctx) {
  const BOX = 220;
  const left = 50;
  const right = PAGE.width - 70;
  const gap = (right - left - SIGNATORIES.length * BOX) / (SIGNATORIES.length - 1);

  for (const [index, signatory] of SIGNATORIES.entries()) {
    const x = left + index * (BOX + gap);
    const centerX = x + BOX / 2;

    const boxBottom = PAGE.height - 47;

    const roleTop = boxBottom - 17 * 1.1;
    drawCentered(ctx, ctx.regular, signatory.role, {
      size: 17,
      lineHeight: 17 * 1.1,
      top: roleTop,
      centerX,
    });

    const nameTop = roleTop - 3 - 18 * 1.1;
    drawCentered(ctx, ctx.regular, signatory.name, {
      size: 18,
      lineHeight: 18 * 1.1,
      top: nameTop,
      centerX,
    });

    const ruleTop = nameTop - 5 - 2;
    ctx.page.drawRectangle({
      x,
      y: fromTop(ruleTop + 2),
      width: BOX,
      height: 2,
      color: BLACK,
    });

    await drawImage(pdf, ctx.page, signatory.file, {
      x: centerX - 100,
      top: ruleTop - 4 - signatory.height,
      width: 200,
      height: signatory.height,
    });
  }
}

/**
 * Draws an image the way CSS `object-fit: contain` would. Returns the height
 * it was actually drawn at, since the badge's own layout depends on it.
 *
 * A missing file is logged and skipped instead of thrown: a certificate short
 * one image is recoverable, a send that dies mid-queue is not.
 */
async function drawImage(
  pdf: PDFDocument,
  page: PDFPage,
  file: string,
  box: {
    x: number;
    top: number;
    width: number;
    height: number;
    align?: "left" | "center" | "center-top";
  },
): Promise<number> {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(path.join(ASSETS, file));
  } catch (error) {
    console.error(`certificate asset missing: ${file}`, error);
    return 0;
  }

  const image = await pdf.embedPng(bytes);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  const x =
    box.align === "left"
      ? box.x
      : box.align === "center-top"
        ? box.x + (box.width - width) / 2
        : box.x + (box.width - width) / 2;
  const y =
    box.align === "left"
      ? fromTop(box.top + height)
      : box.align === "center-top"
        ? fromTop(box.top + height)
        : fromTop(box.top + (box.height + height) / 2);

  page.drawImage(image, { x, y, width, height });

  return height;
}
