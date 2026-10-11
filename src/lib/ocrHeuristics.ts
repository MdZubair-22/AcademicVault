export type OCRQualityStatus = "high" | "medium" | "low";
export type DocumentKind = "pdf" | "image";

export function detectDocumentKind(
  fileName: string,
  mimeType: string,
  header: Uint8Array,
): DocumentKind {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const type = mimeType.toLowerCase();
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => header[index] === byte);
  const isPDF = new TextDecoder().decode(header.subarray(0, 5)) === "%PDF-";
  const isJPEG = startsWith(0xff, 0xd8, 0xff);
  const isPNG = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const isWebP =
    new TextDecoder().decode(header.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(header.subarray(8, 12)) === "WEBP";

  const kind: DocumentKind | undefined =
    type === "application/pdf" || extension === "pdf"
      ? "pdf"
      : ["image/jpeg", "image/png", "image/webp"].includes(type) ||
          ["jpg", "jpeg", "png", "webp"].includes(extension ?? "")
        ? "image"
        : undefined;
  if (!kind) throw new Error("Choose a PDF, JPG, PNG, or WebP document.");

  if (
    (kind === "pdf" && !isPDF) ||
    (kind === "image" && !isJPEG && !isPNG && !isWebP)
  ) {
    throw new Error("The file contents do not match a supported document format.");
  }
  if (
    (type === "application/pdf" && !isPDF) ||
    (type === "image/jpeg" && !isJPEG) ||
    (type === "image/png" && !isPNG) ||
    (type === "image/webp" && !isWebP)
  ) {
    throw new Error("The file type does not match its contents.");
  }
  if (type && type !== "application/octet-stream" &&
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(type)) {
    throw new Error("Choose a PDF, JPG, PNG, or WebP document.");
  }
  return kind;
}

export function hasAmbiguousNumericDate(text: string): boolean {
  const labeled = text.match(
    /(?:issue|issued|issuance|completion|completed|date|dated|awarded|award)\s*(?:date|on|at)?\s*[:\-]?\s*(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})/i,
  );
  return Boolean(
    labeled && Number(labeled[1]) <= 12 && Number(labeled[2]) <= 12,
  );
}

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[|]{2,}/g, "|")
    .trim();
}

export function isUsableNativeText(text: string): boolean {
  const normalized = normalizeExtractedText(text);
  const words = normalized.match(/\b[\p{L}\p{N}]{2,}\b/gu) ?? [];
  const meaningful = normalized.match(/[\p{L}\p{N}]/gu) ?? [];
  return normalized.length >= 40 && words.length >= 6 && meaningful.length >= 30;
}

export function scoreOCRCandidate(confidence: number, text: string): number {
  const wordCount = text.match(/\b[\p{L}\p{N}]{2,}\b/gu)?.length ?? 0;
  return confidence + Math.min(wordCount, 100) * 0.08;
}

export function chooseBetterOCR<T extends { confidence: number; text: string }>(
  current: T,
  candidate: T,
): T {
  return scoreOCRCandidate(candidate.confidence, candidate.text) >
    scoreOCRCandidate(current.confidence, current.text)
    ? candidate
    : current;
}

export function assessOCRQuality(
  text: string,
  ocrConfidence: number | null,
  pageCoverage: number,
): OCRQualityStatus {
  const normalized = normalizeExtractedText(text);
  const wordCount = normalized.match(/\b[\p{L}\p{N}]{2,}\b/gu)?.length ?? 0;

  if (
    normalized.length < 40 ||
    wordCount < 6 ||
    pageCoverage < 0.5 ||
    (ocrConfidence !== null && ocrConfidence < 40)
  ) {
    return "low";
  }

  if (
    normalized.length < 140 ||
    wordCount < 20 ||
    pageCoverage < 0.85 ||
    (ocrConfidence !== null && ocrConfidence < 65)
  ) {
    return "medium";
  }

  return "high";
}
