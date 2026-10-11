import assert from "node:assert/strict";
import test from "node:test";
import {
  assessOCRQuality,
  chooseBetterOCR,
  detectDocumentKind,
  hasAmbiguousNumericDate,
  isUsableNativeText,
  normalizeExtractedText,
} from "../src/lib/ocrHeuristics.ts";
import { cleanOCRTitle, extractGrades, extractHolderName } from "../src/lib/ocrMetadata.ts";
import {
  characterErrorRate,
  classificationAccuracy,
  exactFieldAccuracy,
  summarizeProcessing,
  wordErrorRate,
} from "../src/lib/ocrMetrics.ts";

test("normalizes whitespace without joining PDF page content", () => {
  assert.equal(normalizeExtractedText("Name: Ada  \r\n\r\nCollege\t\tName"), "Name: Ada\n\nCollege Name");
});

test("uses selectable PDF text only when meaningful content is present", () => {
  assert.equal(isUsableNativeText("Student Name: A Person\nUniversity: Example\nGrade: A"), true);
  assert.equal(isUsableNativeText("x 1"), false);
});

test("prefers measured OCR confidence when comparing retry candidates", () => {
  const initial = { text: "certificate awarded to student", confidence: 78 };
  const weaker = { text: "certificate awarded to student candidate date", confidence: 43 };
  assert.equal(chooseBetterOCR(initial, weaker), initial);
});

test("reports heuristic quality bands without treating them as engine confidence", () => {
  assert.equal(assessOCRQuality("", 95, 1), "low");
  assert.equal(assessOCRQuality("Several readable words appear on this page.", 60, 1), "medium");
  assert.equal(assessOCRQuality("This academic document contains enough readable words to review and verify all important details across several lines on this scanned page, including the student and institution fields.", 80, 1), "high");
});

test("checks supported file signatures and rejects extension/content mismatches", () => {
  assert.equal(detectDocumentKind("record.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7")), "pdf");
  assert.equal(detectDocumentKind("scan.jpg", "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image");
  assert.throws(
    () => detectDocumentKind("scan.png", "image/png", new TextEncoder().encode("%PDF-")),
    /contents do not match/,
  );
});

test("keeps ambiguous numeric dates unparsed for manual confirmation", () => {
  assert.equal(hasAmbiguousNumericDate("Issue date: 04/05/2025"), true);
  assert.equal(hasAmbiguousNumericDate("Issue date: 14/05/2025"), false);
});

test("extracts only explicitly labeled names and labeled result values", () => {
  assert.deepEqual(extractHolderName("Awarded to: Ada Example").value, "Ada Example");
  assert.equal(extractHolderName("Ada Example received an award").value, undefined);
  assert.deepEqual(extractHolderName("This is to certify that Ada Example has successfully completed the Python Programming course").value, "Ada Example");
  assert.deepEqual(extractGrades("CGPA: 8.45\nPercentage: 82%"), ["CGPA: 8.45", "Percentage: 82%"]);
});

test("does not mistake generic certificate boilerplate for a document title", () => {
  assert.equal(cleanOCRTitle("COMPLETION"), undefined);
  assert.equal(cleanOCRTitle("Certificate of Completion"), undefined);
  assert.equal(cleanOCRTitle("Python Programming"), "Python Programming");
});

test("calculates CER, WER, field accuracy, classification, runtime and failure rates", () => {
  assert.equal(characterErrorRate("kitten", "sitting"), 0.5);
  assert.equal(wordErrorRate("the cat sat", "the dog sat"), 1 / 3);
  assert.equal(exactFieldAccuracy({ name: "Ada", date: null }, { name: "Ada", date: null }), 1);
  assert.equal(classificationAccuracy(["transcript", "certificate"], ["transcript", "other"]), 0.5);
  assert.deepEqual(summarizeProcessing([100, 300], 1), { averageMs: 200, failureRate: 1 / 3 });
});
