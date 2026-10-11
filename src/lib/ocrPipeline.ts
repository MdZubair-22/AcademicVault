import { createWorker, PSM } from "tesseract.js";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {
  assessOCRQuality,
  chooseBetterOCR,
  detectDocumentKind,
  isUsableNativeText,
  normalizeExtractedText,
} from "./ocrHeuristics";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 20;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_SIDE = 4_000;

export type { DocumentKind } from "./ocrHeuristics";
import type { DocumentKind } from "./ocrHeuristics";

export type OCRExtraction = {
  text: string;
  kind: DocumentKind;
  engine: string;
  pageCount: number;
  processedPageCount: number;
  nativeTextPageCount: number;
  ocrPageCount: number;
  ocrEngineConfidence: number | null;
  qualityStatus: "high" | "medium" | "low";
  processingTimeMs: number;
  imageWidth?: number;
  imageHeight?: number;
  imageQuality?: {
    luminanceDeviation: number;
    edgeVariance: number;
  };
  warnings: string[];
};

type OCRResult = { text: string; confidence: number };

const OCR_PAGE_SEGMENTATION_MODES = [
  PSM.AUTO,
  PSM.SINGLE_BLOCK,
  PSM.SINGLE_COLUMN,
  PSM.SINGLE_LINE,
] satisfies PSM[];

export async function validateDocumentFile(file: File): Promise<DocumentKind> {
  if (file.size === 0) throw new Error("The selected document is empty.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is larger than the 15 MB limit.");
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return detectDocumentKind(file.name, file.type, header);
}

function setPdfWorker(pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs")) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare the page for OCR."));
    }, "image/png");
  });
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeOCRVariants(source: HTMLCanvasElement): HTMLCanvasElement[] {
  const gray = makeCanvas(source.width, source.height);
  const grayContext = gray.getContext("2d", { willReadFrequently: true });
  if (!grayContext) return [];

  grayContext.drawImage(source, 0, 0);
  const originalImage = grayContext.getImageData(0, 0, gray.width, gray.height);
  const histogram = new Uint32Array(256);
  const pixels = originalImage.data.length / 4;

  for (let index = 0; index < originalImage.data.length; index += 4) {
    const value = Math.min(
      255,
      Math.max(
        0,
        Math.round(
          originalImage.data[index] * 0.299 +
            originalImage.data[index + 1] * 0.587 +
            originalImage.data[index + 2] * 0.114,
        ),
      ),
    );
    histogram[value]++;
    originalImage.data[index] = value;
    originalImage.data[index + 1] = value;
    originalImage.data[index + 2] = value;
  }
  grayContext.putImageData(originalImage, 0, 0);

  let totalWeighted = 0;
  for (let i = 0; i < histogram.length; i++) totalWeighted += i * histogram[i];
  let backgroundWeight = 0;
  let backgroundWeighted = 0;
  let bestVariance = 0;
  let threshold = 180;

  for (let i = 0; i < histogram.length; i++) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;
    const foregroundWeight = pixels - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundWeighted += i * histogram[i];
    const backgroundMean = backgroundWeighted / backgroundWeight;
    const foregroundMean =
      (totalWeighted - backgroundWeighted) / foregroundWeight;
    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }

  const enhanced = makeCanvas(gray.width, gray.height);
  const enhancedContext = enhanced.getContext("2d", { willReadFrequently: true });
  if (!enhancedContext) return [gray];
  enhancedContext.filter = "contrast(1.45) brightness(1.06) saturate(0.8)";
  enhancedContext.drawImage(gray, 0, 0);
  enhancedContext.filter = "none";

  const sharpened = makeCanvas(gray.width, gray.height);
  const sharpenedContext = sharpened.getContext("2d", { willReadFrequently: true });
  if (sharpenedContext) {
    sharpenedContext.drawImage(enhanced, 0, 0);
    const sourceImage = sharpenedContext.getImageData(0, 0, sharpened.width, sharpened.height);
    const targetImage = new ImageData(new Uint8ClampedArray(sourceImage.data), sourceImage.width, sourceImage.height);
    for (let y = 1; y < sourceImage.height - 1; y++) {
      for (let x = 1; x < sourceImage.width - 1; x++) {
        const index = (y * sourceImage.width + x) * 4;
        const left = (y * sourceImage.width + x - 1) * 4;
        const right = (y * sourceImage.width + x + 1) * 4;
        const up = ((y - 1) * sourceImage.width + x) * 4;
        const down = ((y + 1) * sourceImage.width + x) * 4;

        const baseR = sourceImage.data[index];
        const baseG = sourceImage.data[index + 1];
        const baseB = sourceImage.data[index + 2];
        const edgeR = Math.max(0, Math.min(255, baseR * 1.3 - sourceImage.data[left] * 0.2 - sourceImage.data[right] * 0.2 - sourceImage.data[up] * 0.2 - sourceImage.data[down] * 0.2));
        const edgeG = Math.max(0, Math.min(255, baseG * 1.3 - sourceImage.data[left + 1] * 0.2 - sourceImage.data[right + 1] * 0.2 - sourceImage.data[up + 1] * 0.2 - sourceImage.data[down + 1] * 0.2));
        const edgeB = Math.max(0, Math.min(255, baseB * 1.3 - sourceImage.data[left + 2] * 0.2 - sourceImage.data[right + 2] * 0.2 - sourceImage.data[up + 2] * 0.2 - sourceImage.data[down + 2] * 0.2));
        targetImage.data[index] = edgeR;
        targetImage.data[index + 1] = edgeG;
        targetImage.data[index + 2] = edgeB;
      }
    }
    sharpenedContext.putImageData(targetImage, 0, 0);
  }

  const binary = makeCanvas(source.width, source.height);
  const binaryContext = binary.getContext("2d", { willReadFrequently: true });
  if (!binaryContext) return [gray, enhanced, sharpened];
  binaryContext.drawImage(sharpened, 0, 0);
  const binaryImage = binaryContext.getImageData(
    0,
    0,
    binary.width,
    binary.height,
  );
  for (let index = 0; index < binaryImage.data.length; index += 4) {
    const value = binaryImage.data[index] > threshold ? 255 : 0;
    binaryImage.data[index] = value;
    binaryImage.data[index + 1] = value;
    binaryImage.data[index + 2] = value;
  }
  binaryContext.putImageData(binaryImage, 0, 0);
  return [gray, enhanced, sharpened, binary];
}

function rotateCanvas(
  source: HTMLCanvasElement,
  angleDegrees: number,
): HTMLCanvasElement {
  const quarterTurn = Math.abs(angleDegrees) % 180 === 90;
  const rotated = makeCanvas(
    quarterTurn ? source.height : source.width,
    quarterTurn ? source.width : source.height,
  );
  const context = rotated.getContext("2d");
  if (!context) return source;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, rotated.width, rotated.height);
  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate((angleDegrees * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return rotated;
}

function estimateSkewAngle(source: HTMLCanvasElement): number {
  const scale = Math.min(1, 420 / Math.max(source.width, source.height));
  const sample = makeCanvas(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale)),
  );
  const base = makeCanvas(sample.width, sample.height);
  const context = sample.getContext("2d", { willReadFrequently: true });
  const baseContext = base.getContext("2d");
  if (!context || !baseContext) return 0;
  baseContext.fillStyle = "#fff";
  baseContext.fillRect(0, 0, base.width, base.height);
  baseContext.drawImage(source, 0, 0, base.width, base.height);

  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -5; angle <= 5; angle += 0.5) {
    context.save();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, sample.width, sample.height);
    context.translate(sample.width / 2, sample.height / 2);
    context.rotate((angle * Math.PI) / 180);
    context.drawImage(base, -sample.width / 2, -sample.height / 2);
    context.restore();

    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    const rowInk = new Uint32Array(sample.height);
    for (let y = 0; y < sample.height; y++) {
      for (let x = 0; x < sample.width; x++) {
        const index = (y * sample.width + x) * 4;
        if (
          data[index] * 0.299 +
            data[index + 1] * 0.587 +
            data[index + 2] * 0.114 <
          150
        ) {
          rowInk[y]++;
        }
      }
    }
    const scores = rowInk.slice(
      Math.floor(sample.height * 0.08),
      Math.ceil(sample.height * 0.92),
    );
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const score =
      scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      scores.length;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

function deskewCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const angle = estimateSkewAngle(source);
  return Math.abs(angle) >= 0.5 ? rotateCanvas(source, angle) : source;
}

async function recognize(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Blob | HTMLCanvasElement,
  pageSegmentationMode: PSM = PSM.AUTO,
): Promise<OCRResult> {
  await worker.setParameters({
    tessedit_pageseg_mode: pageSegmentationMode,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;()[]{}#/\\@%&+-=<>_/'\"°©®™? !?\n\t",
    classify_bln_numeric_mode: "1",
    textord_heavy_nr: "1",
    user_defined_dpi: "300",
  });

  const { data } = await worker.recognize(image);
  return {
    text: normalizeExtractedText(data.text ?? ""),
    confidence:
      typeof data.confidence === "number" && Number.isFinite(data.confidence)
        ? Math.max(0, Math.min(100, data.confidence))
        : 0,
  };
}

function imageCanvasFromBitmap(bitmap: ImageBitmap): HTMLCanvasElement {
  if (
    bitmap.width * bitmap.height > MAX_IMAGE_PIXELS * 2 ||
    bitmap.width > 20_000 ||
    bitmap.height > 20_000
  ) {
    bitmap.close();
    throw new Error("Image dimensions are too large to process safely.");
  }

  const requestedScale = Math.min(
    3,
    Math.max(1, 1_800 / Math.min(bitmap.width, bitmap.height)),
  );
  const safeScale = Math.min(
    requestedScale,
    MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
    Math.sqrt(MAX_IMAGE_PIXELS / (bitmap.width * bitmap.height)),
  );
  const width = Math.max(1, Math.round(bitmap.width * safeScale));
  const height = Math.max(1, Math.round(bitmap.height * safeScale));
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("Could not initialize image processing.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

function measureImageQuality(source: HTMLCanvasElement) {
  const sample = makeCanvas(192, 192);
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return { luminanceDeviation: 0, edgeVariance: 0 };
  context.drawImage(source, 0, 0, sample.width, sample.height);
  const { data } = context.getImageData(0, 0, sample.width, sample.height);
  const gray = new Float32Array(sample.width * sample.height);
  let sum = 0;
  for (let pixel = 0; pixel < gray.length; pixel++) {
    const index = pixel * 4;
    const value =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    gray[pixel] = value;
    sum += value;
  }
  const mean = sum / gray.length;
  let luminanceVariance = 0;
  let edgeSum = 0;
  let edgeSquaredSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < sample.height - 1; y++) {
    for (let x = 1; x < sample.width - 1; x++) {
      const index = y * sample.width + x;
      const delta = gray[index] - mean;
      luminanceVariance += delta * delta;
      const laplacian =
        gray[index - sample.width] +
        gray[index - 1] +
        gray[index + 1] +
        gray[index + sample.width] -
        4 * gray[index];
      edgeSum += laplacian;
      edgeSquaredSum += laplacian * laplacian;
      edgeCount++;
    }
  }
  const edgeMean = edgeSum / edgeCount;
  return {
    luminanceDeviation: Math.sqrt(luminanceVariance / gray.length),
    edgeVariance: Math.max(0, edgeSquaredSum / edgeCount - edgeMean ** 2),
  };
}

function pdfPageText(items: Array<{ str?: string; transform?: number[]; height?: number; hasEOL?: boolean }>): string {
  const rows: Array<{ y: number; parts: Array<{ x: number; text: string; end: boolean }> }> = [];

  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, (item.height ?? 10) * 0.35));
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, text, end: Boolean(item.hasEOL) });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .reduce((line, part, index) => {
          const separator = index > 0 && !line.endsWith(" ") ? " " : "";
          return `${line}${separator}${part.text}${part.end ? "\n" : ""}`;
        }, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function mergePageText(nativeText: string, ocrText: string): string {
  const native = normalizeExtractedText(nativeText);
  const recognized = normalizeExtractedText(ocrText);
  if (!native) return recognized;
  if (!recognized) return native;

  const nativeComparable = native.toLocaleLowerCase();
  const recognizedComparable = recognized.toLocaleLowerCase();
  if (nativeComparable.includes(recognizedComparable)) return native;
  if (recognizedComparable.includes(nativeComparable)) return recognized;

  const existingLines = new Set(
    native.split("\n").map((line) => line.toLocaleLowerCase().replace(/\W/g, "")),
  );
  const additionalLines = recognized
    .split("\n")
    .filter((line) => {
      const key = line.toLocaleLowerCase().replace(/\W/g, "");
      return key.length > 2 && !existingLines.has(key);
    });
  return normalizeExtractedText([native, ...additionalLines].join("\n"));
}

async function renderPdfPage(page: any): Promise<HTMLCanvasElement> {
  const unitViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    300 / 72,
    Math.sqrt(MAX_IMAGE_PIXELS / (unitViewport.width * unitViewport.height)),
    MAX_IMAGE_SIDE / Math.max(unitViewport.width, unitViewport.height),
  );
  const viewport = page.getViewport({ scale });
  const canvas = makeCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not render a PDF page for OCR.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas;
}

async function extractPDF(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<OCRExtraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  setPdfWorker(pdfjs);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    maxImageSize: MAX_IMAGE_PIXELS,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const processedPageCount = Math.min(pageCount, MAX_PDF_PAGES);
  const warnings: string[] = [];
  if (pageCount > MAX_PDF_PAGES) {
    warnings.push(
      `This PDF has ${pageCount} pages. Only the first ${MAX_PDF_PAGES} pages were processed to keep OCR responsive.`,
    );
  }

  let currentPageNumber = 1;
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  const getWorker = async () => {
    if (!worker) {
      worker = await createWorker("eng", 1, {
        logger: (event) => {
          if (
            typeof event.progress === "number" &&
            Number.isFinite(event.progress)
          ) {
            onProgress?.(
              Math.min(
                0.99,
                ((currentPageNumber - 1 + event.progress) /
                  processedPageCount) *
                  0.95,
              ),
            );
          }
        },
      });
    }
    return worker;
  };
  const pages: string[] = [];
  const ocrConfidences: number[] = [];
  let nativeTextPageCount = 0;
  let ocrPageCount = 0;

  try {
    for (let pageNumber = 1; pageNumber <= processedPageCount; pageNumber++) {
      currentPageNumber = pageNumber;
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const nativeText = pdfPageText(
        content.items as Array<{
          str?: string;
          transform?: number[];
          height?: number;
          hasEOL?: boolean;
        }>,
      );
      let pageText = nativeText;

      if (isUsableNativeText(nativeText)) {
        nativeTextPageCount++;
      } else {
        const canvas = await renderPdfPage(page);
        const original = await recognize(
          await getWorker(),
          await canvasBlob(canvas),
        );
        let best = original;

        if (original.text.length < 80 || original.confidence < 55) {
          const alternatives = makeOCRVariants(deskewCanvas(canvas));
          for (const [index, alternative] of alternatives.entries()) {
            const mode = OCR_PAGE_SEGMENTATION_MODES[
              Math.min(index, OCR_PAGE_SEGMENTATION_MODES.length - 1)
            ];
            const candidate = await recognize(
              await getWorker(),
              await canvasBlob(alternative),
              mode,
            );
            best = chooseBetterOCR(best, candidate);
          }
        }

        pageText = mergePageText(nativeText, best.text);
        if (best.text) {
          ocrPageCount++;
          ocrConfidences.push(best.confidence);
        }
      }

      pages.push(`--- Page ${pageNumber} ---\n${pageText}`.trim());
      page.cleanup();
      onProgress?.(pageNumber / processedPageCount);
    }
  } finally {
    if (worker) await worker.terminate();
    await loadingTask.destroy();
  }

  const text = normalizeExtractedText(pages.join("\n\n"));
  const coverage = pages.filter((page) => page.split("\n").length > 1).length /
    processedPageCount;
  const ocrEngineConfidence = ocrConfidences.length
    ? ocrConfidences.reduce((sum, confidence) => sum + confidence, 0) /
      ocrConfidences.length
    : null;
  const qualityStatus = assessOCRQuality(
    text,
    ocrEngineConfidence,
    coverage,
  );
  if (qualityStatus === "low") {
    warnings.push("Little readable text was extracted. Upload a clearer scan or verify the pages manually.");
  } else if (qualityStatus === "medium") {
    warnings.push("Some extracted text may need review against the original document.");
  }

  return {
    text,
    kind: "pdf",
    engine: nativeTextPageCount && ocrPageCount
      ? "PDF.js text extraction + Tesseract.js OCR"
      : nativeTextPageCount
        ? "PDF.js text extraction"
        : "Tesseract.js OCR",
    pageCount,
    processedPageCount,
    nativeTextPageCount,
    ocrPageCount,
    ocrEngineConfidence,
    qualityStatus,
    processingTimeMs: 0,
    warnings,
  };
}

async function extractImage(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<OCRExtraction> {
  const bitmap = await createImageBitmap(file);
  const imageWidth = bitmap.width;
  const imageHeight = bitmap.height;
  const warnings: string[] = [];
  if (Math.min(imageWidth, imageHeight) < 900) {
    warnings.push("The image has limited resolution. Check small text and numbers carefully.");
  }
  const canvas = imageCanvasFromBitmap(bitmap);
  const imageQuality = measureImageQuality(canvas);
  if (imageQuality.luminanceDeviation < 28) {
    warnings.push("The image has low contrast; inspect text against the original.");
  }
  if (imageQuality.edgeVariance < 35) {
    warnings.push("The image may be soft or blurry; verify small text and numbers.");
  }
  const worker = await createWorker("eng", 1, {
    logger: (event) => {
      if (typeof event.progress === "number") {
        onProgress?.(Math.min(0.95, event.progress * 0.95));
      }
    },
  });

  let result: OCRResult;
  try {
    result = await recognize(worker, canvas, PSM.SINGLE_BLOCK);

    const retryCanvas = deskewCanvas(canvas);
    const variantCandidates = makeOCRVariants(retryCanvas);
    for (const [index, variant] of variantCandidates.entries()) {
      const mode = OCR_PAGE_SEGMENTATION_MODES[Math.min(index, OCR_PAGE_SEGMENTATION_MODES.length - 1)];
      const candidate = await recognize(worker, variant, mode);
      result = chooseBetterOCR(result, candidate);
    }

    if ((result.text.match(/\b[\p{L}\p{N}]{2,}\b/gu)?.length ?? 0) < 5) {
      for (const angle of [90, 180, 270]) {
        const candidate = await recognize(worker, rotateCanvas(canvas, angle), PSM.SINGLE_BLOCK);
        result = chooseBetterOCR(result, candidate);
      }
    }
  } finally {
    await worker.terminate();
  }

  const text = normalizeExtractedText(result.text);
  const qualityStatus = assessOCRQuality(text, result.confidence, text ? 1 : 0);
  if (qualityStatus === "low") {
    warnings.push("Little readable text was recognized. Retry with a clearer, upright scan.");
  } else if (qualityStatus === "medium") {
    warnings.push("OCR found text, but verify names, dates, and identifiers against the original.");
  }

  return {
    text: text ? `--- Page 1 ---\n${text}` : "",
    kind: "image",
    engine: "Tesseract.js",
    pageCount: 1,
    processedPageCount: 1,
    nativeTextPageCount: 0,
    ocrPageCount: text ? 1 : 0,
    ocrEngineConfidence: result.confidence,
    qualityStatus,
    processingTimeMs: 0,
    imageWidth,
    imageHeight,
    imageQuality,
    warnings,
  };
}

export async function extractDocumentText(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<OCRExtraction> {
  const started = performance.now();
  const kind = await validateDocumentFile(file);
  onProgress?.(0);
  const extraction =
    kind === "pdf"
      ? await extractPDF(file, onProgress)
      : await extractImage(file, onProgress);
  extraction.processingTimeMs = Math.round(performance.now() - started);
  onProgress?.(1);
  return extraction;
}
