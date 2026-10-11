import { createWorker } from 'tesseract.js';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { extractDocumentText, OCRExtraction } from './ocrPipeline';
import { hasAmbiguousNumericDate } from './ocrHeuristics';
import { cleanOCRTitle, extractGrades, extractHolderName } from './ocrMetadata';

export type AIAnalysis = {
  text: string;
  category: string;
  confidence: number;
  extraction: OCRExtraction;
  holderName?: string;
  grades: string[];
  fieldEvidence: Record<string, 'explicit-label' | 'text-pattern' | 'not-detected'>;
  title?: string;
  institution?: string;
  documentDate?: string;
  certificateId?: string;
  academicYear?: string;
  semester?: string;
  courseName?: string;
  skills: string[];
  warnings: string[];
};

type OCRResult = {
  text: string;
  confidence: number;
};

const academicCategories: Array<[string, RegExp]> = [
  ['marksheet', /marks?\s*sheet|statement\s+of\s+marks|grade\s*card|semester/i],
  ['grade_card', /grade\s*card|grade\s*sheet/i],
  ['transcript', /transcript|academic\s+record/i],
  ['academic_letter', /bonafide|provisional|academic\s+letter|letter\s+of/i],
  ['degree', /degree|bachelor|master\s+of|graduation|convocation/i],
  ['certificate', /certificate|certification|successfully\s+completed|completion/i],
  ['internship', /internship|intern/i],
  ['achievement', /award|achievement|winner|runner[- ]up|hackathon|competition/i],
];

const knownSkills = [
  'Python',
  'Java',
  'JavaScript',
  'TypeScript',
  'C++',
  'C#',
  'C',
  'SQL',
  'MySQL',
  'PostgreSQL',
  'MongoDB',
  'React',
  'React.js',
  'Node.js',
  'Express',
  'FastAPI',
  'Flask',
  'TensorFlow',
  'Keras',
  'PyTorch',
  'Machine Learning',
  'Deep Learning',
  'Artificial Intelligence',
  'Data Science',
  'Data Analytics',
  'Power BI',
  'Excel',
  'AWS',
  'Azure',
  'Git',
  'GitHub',
  'HTML',
  'CSS',
  'Tailwind CSS',
  'Figma',
  'Docker',
  'OpenCV',
  'NLP',
  'Computer Vision',
];

const organizationWords =
  /university|college|institute|institution|academy|school|organization|organisation|technologies|technology|foundation|company|corporation|ltd|limited|inc|coursera|udemy|google|microsoft|ibm|nptel|infosys|tcs|accenture|aws|oracle|cisco|linkedin/i;

const boilerplateWords =
  /certificate|certification|completion|successfully|completed|congratulations|presented|awarded|issued|participant|participation|this\s+is|has\s+successfully/i;

const academicTitleKeywords =
  /(certificate\s+of|completion\s+certificate|participation\s+certificate|achievement\s+certificate|course|training|workshop|internship|program|programme|subject|title|module|semester|marksheet|transcript|grade\s*card)/i;

function cleanOCRText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[|]{2,}/g, '|')
    .trim();
}

function normalizeOCRLine(line: string): string {
  return line
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isUUIDLike(value: string): boolean {
  const v = value
    .replace(/\.[^.]+$/, '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();

  if (/^[a-f0-9]{24,}$/.test(v)) return true;
  if (/^[a-f0-9]{8,}(?:-[a-f0-9]{4,}){2,}$/.test(v)) return true;

  return false;
}

function cleanField(value?: string): string | undefined {
  if (!value) return undefined;

  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\-.]+/, '')
    .replace(/[\s:;,\-.]+$/, '')
    .trim();

  if (!cleaned) return undefined;
  if (isUUIDLike(cleaned)) return undefined;
  if (/^(course|certificate|certification|date|issued|issue|id|number|no)$/i.test(cleaned)) return undefined;

  return cleaned;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const value = cleanField(match[1]);

      if (value) return value;
    }
  }

  return undefined;
}

function parseDateValue(raw?: string): string | undefined {
  if (!raw) return undefined;

  const value = raw
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // YYYY-MM-DD
  let m = value.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);

  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    if (isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}`;
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY
  m = value.match(
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/,
  );

  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let year = Number(m[3]);

    if (year < 100) year += 2000;
    if (a <= 12 && b <= 12) return undefined;

    let day = a;
    let month = b;

    // If first number cannot be a month, definitely DD/MM.
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      day = b;
      month = a;
    }

    if (isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}`;
    }
  }

  const months: Record<string, number> = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
  };

  // 24 August 2026
  m = value.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s*(20\d{2})\b/i,
  );

  if (m) {
    const day = Number(m[1]);
    const month = months[m[2].toLowerCase()];
    const year = Number(m[3]);

    if (month && isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}`;
    }
  }

  // August 24, 2026
  m = value.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );

  if (m) {
    const month = months[m[1].toLowerCase()];
    const day = Number(m[2]);
    const year = Number(m[3]);

    if (month && isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0',
      )}`;
    }
  }

  return undefined;
}

function extractDate(text: string): string | undefined {
  const explicit = firstMatch(text, [
    /(?:issue|issued|issuance|completion|completed|date|dated|awarded|award)\s*(?:date|on|at)?\s*[:\-]?\s*([A-Za-z]{3,12}\s+\d{1,2},?\s+20\d{2})/i,

    /(?:issue|issued|issuance|completion|completed|date|dated|awarded|award)\s*(?:date|on|at)?\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,12}\s*,?\s+20\d{2})/i,

    /(?:issue|issued|issuance|completion|completed|date|dated|awarded|award)\s*(?:date|on|at)?\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i,
  ]);

  const parsedExplicit = parseDateValue(explicit);

  if (parsedExplicit) return parsedExplicit;

  // Search entire OCR text for a date as a fallback.
  const fallbackPatterns = [
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/,
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*,?\s+20\d{2}\b/i,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}\b/i,
  ];

  for (const pattern of fallbackPatterns) {
    const match = text.match(pattern);

    if (match?.[0]) {
      const parsed = parseDateValue(match[0]);

      if (parsed) return parsed;
    }
  }

  return undefined;
}

function extractCertificateId(text: string): string | undefined {
  const result = firstMatch(text, [
    /(?:certificate|credential|credential\s+id|certificate\s+id|certificate\s+number|certificate\s+no\.?|credential\s+number|serial\s+number|serial\s+no\.?|registration\s+number|registration\s+no\.?|reference\s+number|ref\.?\s*no\.?|id)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\/_.\-]{3,50})/i,

    /(?:verify|verification)\s*(?:code|id)?\s*[:#\-]\s*([A-Z0-9][A-Z0-9\/_.\-]{3,50})/i,
  ]);

  if (!result || !/\d/.test(result) || result.length < 5) return undefined;

  if (
    /^(date|issued|issue|certificate|credential|number|no|id)$/i.test(result)
  ) {
    return undefined;
  }

  return result;
}

function extractInstitution(text: string): string | undefined {
  const direct = firstMatch(text, [
    /(?:issued\s+by|issued\s+from|awarded\s+by|presented\s+by|provided\s+by|offered\s+by|organized\s+by|organised\s+by)\s*[:\-]?\s*([^\n]{3,150})/i,

    /(?:issuing\s+organization|issuing\s+organisation|issuing\s+institution|issuing\s+body)\s*[:\-]\s*([^\n]{3,150})/i,

    /(?:institution|university|college|institute|academy)\s*[:\-]\s*([^\n]{3,150})/i,
  ]);

  if (direct) {
    return direct.replace(/[.,;:]+$/, '').trim();
  }

  const lines = text
    .split('\n')
    .map(normalizeOCRLine)
    .filter((line) => line.length >= 4 && line.length <= 140);

  const candidates = lines.filter((line) => {
    if (!organizationWords.test(line)) return false;
    if (/^(certificate|certification|date|issued|issue|id)$/i.test(line))
      return false;

    return true;
  });

  if (candidates.length > 0) {
    return candidates
      .sort((a, b) => {
        const score = (v: string) =>
          (organizationWords.test(v) ? 5 : 0) +
          (v.length >= 8 ? 2 : 0) +
          (v.length <= 100 ? 1 : 0);

        return score(b) - score(a);
      })[0]
      .trim();
  }

  return undefined;
}

export function extractTitle(text: string, fileName: string): string | undefined {
  const direct = firstMatch(text, [
    /certificate\s+of\s+(?:completion|participation|achievement)\s*(?:in|for|on|[:\-])\s*([^\n]{4,150})/i,
    /(?:certificate\s+of|certificate\s+for)\s+([^\n]{4,150})/i,
    /(?:successfully\s+completed|successfully\s+completing)\s+(?:the\s+)?([^\n]{4,180})/i,
    /(?:has\s+successfully\s+completed|have\s+successfully\s+completed)\s+(?:the\s+)?([^\n]{4,180})/i,
    /(?:course\s+name|course|program|programme|training|workshop|internship)\s*[:\-]\s*([^\n]{4,150})/i,
    /(?:title|subject)\s*[:\-]\s*([^\n]{4,150})/i,
    /(?:semester|term|marksheet|transcript|grade\s*card|grade\s*sheet)\s*[:\-]?\s*([^\n]{4,150})/i,
  ]);

  const cleanTitle = (value?: string) => {
    const cleaned = cleanField(value)
      ?.replace(/\s+(?:issued|issue date|date|certificate id|credential id|serial number|verification code)\s*[:\-].*$/i, '')
      .replace(/\s+\(?(?:C?GPA|percentage|marks|grade|score|code)\b.*$/i, '')
      .trim();
    return cleanOCRTitle(cleaned);
  };

  const directTitle = cleanTitle(direct);
  if (directTitle) {
    return directTitle;
  }

  const lines = text
    .split('\n')
    .map(normalizeOCRLine)
    .filter((line) => line.length >= 5 && line.length <= 160);

  const candidates = lines
    .map((line) => {
      let score = 0;

      if (academicTitleKeywords.test(line)) score += 8;
      if (/certificate\s+of/i.test(line)) score += 12;
      if (/successfully\s+completed/i.test(line)) score += 10;
      if (/course/i.test(line)) score += 9;
      if (/training/i.test(line)) score += 8;
      if (/workshop/i.test(line)) score += 8;
      if (/internship/i.test(line)) score += 8;
      if (/program|programme/i.test(line)) score += 7;
      if (/achievement/i.test(line)) score += 6;
      if (/semester|marksheet|transcript|grade\s*card/i.test(line)) score += 10;

      if (boilerplateWords.test(line)) score -= 2;
      if (organizationWords.test(line)) score -= 5;
      if (/\b(date|issued|id|serial|number|verification|result|grade|gpa)\b/i.test(line))
        score -= 6;

      if (/^(?:this\s+is\s+to\s+certify|certificate(?:\s+of\s+(?:completion|participation|achievement))?|completion\s+certificate|participation\s+certificate|certification)$/i.test(line)) score -= 100;
      if (/^(?:student\s+name|candidate\s+name|awardee|issued\s+to|presented\s+to|date|id|certificate\s+number|verification\s+code)$/i.test(line)) score -= 100;
      if (isUUIDLike(line)) score -= 100;

      if (line.split(/\s+/).length >= 3) score += 2;

      return { line, score };
    })
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    return cleanTitle(candidates[0].line);
  }

  const fallbackName = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!isUUIDLike(fallbackName) && fallbackName.length >= 4) {
    return fallbackName;
  }

  return undefined;
}

function extractCourseName(text: string, title?: string): string | undefined {
  const result = firstMatch(text, [
    /(?:course\s+name|course|program|programme|training|workshop)\s*[:\-]\s*([^\n]{4,150})/i,

    /(?:successfully\s+completed|completed)\s+(?:the\s+)?(?:course|program|programme|training)?\s*[:\-]?\s*([^\n]{4,150})/i,
  ]);

  if (result && !/^\d+$/.test(result) && !/^(course|certificate|certification|training|program|programme)$/i.test(result)) return result;

  if (title && !/^(certificate|certification)$/i.test(title)) {
    return title;
  }

  return undefined;
}

function extractSemester(text: string): string | undefined {
  return firstMatch(text, [
    /(?:semester|sem|term)\s*[:#\-]?\s*(\d{1,2})/i,
  ]);
}

function extractAcademicYear(text: string): string | undefined {
  const normalized = text.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
  const match = normalized.match(/\b((?:19|20)\d{2})\s*[-/]\s*((?:19|20)\d{2})\b/);
  if (!match) return undefined;

  return `${match[1]} – ${match[2]}`;
}

function extractSkills(text: string): string[] {
  const normalized = text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');

  const found: string[] = [];

  for (const skill of knownSkills) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pattern = new RegExp(`(^|[^a-zA-Z0-9+#])${escaped}([^a-zA-Z0-9+#]|$)`, 'i');

    if (pattern.test(normalized)) {
      found.push(skill);
    }
  }

  return [...new Set(found)];
}

function classify(text: string) {
  const normalized = text.toLowerCase();

  const scores = academicCategories.map(([key, pattern]) => {
    const matches = normalized.match(pattern);

    return {
      key,
      score: matches ? 0.78 : 0,
    };
  });

  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];

  return {
    category: best.score ? best.key : 'other',
    confidence: best.score,
  };
}

function createCanvasFromFile(file: File, scale = 2.4): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);

      const maxDimension = 3200;

      let width = Math.round(image.naturalWidth * scale);
      let height = Math.round(image.naturalHeight * scale);

      if (Math.max(width, height) > maxDimension) {
        const ratio = maxDimension / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
      });

      if (!ctx) {
        reject(new Error('Could not create image processing canvas.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(image, 0, 0, width, height);

      resolve(canvas);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the uploaded image.'));
    };

    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not prepare image for OCR.'));
      },
      type,
      0.95,
    );
  });
}

async function createOCRVariants(file: File): Promise<Blob[]> {
  const base = await createCanvasFromFile(file, 2.6);

  const originalBlob = await canvasToBlob(base, 'image/png');

  const enhanced = document.createElement('canvas');
  enhanced.width = base.width;
  enhanced.height = base.height;

  const ctx = enhanced.getContext('2d', {
    willReadFrequently: true,
  });

  if (!ctx) {
    return [originalBlob];
  }

  ctx.drawImage(base, 0, 0);

  const imageData = ctx.getImageData(
    0,
    0,
    enhanced.width,
    enhanced.height,
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Increase contrast without destroying colored certificate text.
    gray = ((gray - 128) * 1.35) + 128;

    gray = Math.max(0, Math.min(255, gray));

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  const enhancedBlob = await canvasToBlob(enhanced, 'image/png');
  const threshold = document.createElement('canvas');
  threshold.width = base.width;
  threshold.height = base.height;
  const thresholdCtx = threshold.getContext('2d', { willReadFrequently: true });
  if (!thresholdCtx) return [originalBlob, enhancedBlob];
  thresholdCtx.drawImage(base, 0, 0);
  const thresholdData = thresholdCtx.getImageData(0, 0, threshold.width, threshold.height);
  for (let i = 0; i < thresholdData.data.length; i += 4) {
    const gray = 0.299 * thresholdData.data[i] + 0.587 * thresholdData.data[i + 1] + 0.114 * thresholdData.data[i + 2];
    const value = gray > 178 ? 255 : 0;
    thresholdData.data[i] = value;
    thresholdData.data[i + 1] = value;
    thresholdData.data[i + 2] = value;
    thresholdData.data[i + 3] = 255;
  }
  thresholdCtx.putImageData(thresholdData, 0, 0);
  return [originalBlob, enhancedBlob, await canvasToBlob(threshold, 'image/png')];
}

const OCR_PAGE_SEGMENTATION_MODES = ['3', '6', '11'];

async function recognizeBlob(
  worker: any,
  blob: Blob,
  psm: string,
): Promise<OCRResult> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
  } as any);

  const result = await worker.recognize(blob);

  const text = cleanOCRText(result.data?.text ?? '');

  const confidence =
    typeof result.data?.confidence === 'number'
      ? result.data.confidence
      : 0;

  return {
    text,
    confidence,
  };
}

async function createOCRWorker(
  onProgress?: (p: number) => void,
) {
  return createWorker('eng', 1, {
    logger: (message: any) => {
      if (
        message &&
        typeof message.progress === 'number' &&
        Number.isFinite(message.progress)
      ) {
        onProgress?.(Math.max(0, Math.min(1, message.progress)));
      }
    },
  });
}

async function ocrImage(
  file: File,
  onProgress?: (p: number) => void,
): Promise<string> {
  const worker = await createOCRWorker(onProgress);

  try {
    const variants = await createOCRVariants(file);

    let best: OCRResult = {
      text: '',
      confidence: -1,
    };

    const total = variants.length * OCR_PAGE_SEGMENTATION_MODES.length;
    let completed = 0;

    for (const variant of variants) {
      for (const psm of OCR_PAGE_SEGMENTATION_MODES) {
        const result = await recognizeBlob(worker, variant, psm);

        completed++;

        onProgress?.(completed / total);

          const quality =
            result.confidence +
            Math.min(8, result.text.length / 250);

          const bestQuality =
            best.confidence +
            Math.min(8, best.text.length / 250);

        if (
          !best.text ||
          quality > bestQuality
        ) {
          best = result;
        }
      }
    }

    return best.text;
  } finally {
    await worker.terminate();
  }
}

async function renderPdfPages(
  file: File,
  onProgress?: (p: number) => void,
): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  /*
   * IMPORTANT:
   * pdfjs-dist 5.x requires workerSrc in a Vite browser application.
   * This fixes:
   * "No GlobalWorkerOptions.workerSrc specified."
   */
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());

  const pdf = await pdfjs.getDocument({
    data,
    disableAutoFetch: false,
    disableStream: false,
  }).promise;

  const maxPages = Math.min(pdf.numPages, 5);

  const worker = await createOCRWorker();

  let combined = '';

  try {
    for (let n = 1; n <= maxPages; n++) {
      const page = await pdf.getPage(n);

      /*
       * High resolution rendering is important.
       * 2.5x is substantially better than the old 1.7x
       * for scanned certificates and marksheets.
       */
      const viewport = page.getViewport({
        scale: 2.5,
      });

      const canvas = document.createElement('canvas');

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
      });

      if (!ctx) continue;

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const blob = await canvasToBlob(canvas, 'image/png');

      let best: OCRResult = {
        text: '',
        confidence: -1,
      };

      const variants: Blob[] = [blob];

      // Add enhanced grayscale variant.
      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const enhanced = document.createElement('canvas');

      enhanced.width = canvas.width;
      enhanced.height = canvas.height;

      const ectx = enhanced.getContext('2d', {
        willReadFrequently: true,
      });

      if (ectx) {
        const enhancedData = ectx.createImageData(
          imageData.width,
          imageData.height,
        );

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];

          let gray =
            0.299 * r +
            0.587 * g +
            0.114 * b;

          gray = ((gray - 128) * 1.35) + 128;

          gray = Math.max(0, Math.min(255, gray));

          enhancedData.data[i] = gray;
          enhancedData.data[i + 1] = gray;
          enhancedData.data[i + 2] = gray;
          enhancedData.data[i + 3] = 255;
        }

        ectx.putImageData(enhancedData, 0, 0);

        variants.push(await canvasToBlob(enhanced, 'image/png'));

        const threshold = document.createElement('canvas');
        threshold.width = canvas.width;
        threshold.height = canvas.height;
        const thresholdCtx = threshold.getContext('2d', { willReadFrequently: true });
        if (thresholdCtx) {
          thresholdCtx.drawImage(canvas, 0, 0);
          const thresholdData = thresholdCtx.getImageData(0, 0, threshold.width, threshold.height);
          for (let i = 0; i < thresholdData.data.length; i += 4) {
            const gray = 0.299 * thresholdData.data[i] + 0.587 * thresholdData.data[i + 1] + 0.114 * thresholdData.data[i + 2];
            const value = gray > 178 ? 255 : 0;
            thresholdData.data[i] = value;
            thresholdData.data[i + 1] = value;
            thresholdData.data[i + 2] = value;
            thresholdData.data[i + 3] = 255;
          }
          thresholdCtx.putImageData(thresholdData, 0, 0);
          variants.push(await canvasToBlob(threshold, 'image/png'));
        }
      }

      for (const variant of variants) {
        for (const psm of OCR_PAGE_SEGMENTATION_MODES) {
          const result = await recognizeBlob(worker, variant, psm);
          const quality = result.confidence + Math.min(8, result.text.length / 250);
          const bestQuality = best.confidence + Math.min(8, best.text.length / 250);
          if (!best.text || quality > bestQuality) best = result;
        }
      }

      if (best.text) {
        combined +=
          `\n--- Page ${n} ---\n${best.text}`;
      }

      onProgress?.(n / maxPages);
    }
  } finally {
    await worker.terminate();
  }

  return cleanOCRText(combined);
}

export async function analyzeDocument(
  file: File,
  onProgress?: (p: number) => void,
): Promise<AIAnalysis> {
  const extraction = await extractDocumentText(file, onProgress);
  const text = cleanOCRText(extraction.text);
  const classification = classify(text);
  const title = extractTitle(text, "");
  const institution = extractInstitution(text);
  const documentDate = extractDate(text);
  const holder = extractHolderName(text);
  const certificateId = extractCertificateId(text);
  const semester = extractSemester(text);
  const academicYear = extractAcademicYear(text);
  const courseName = extractCourseName(text, title);
  const grades = extractGrades(text);
  let skills = extractSkills(text);
  const warnings = [...extraction.warnings];

  if (!institution) warnings.push("Institution was not detected from the recognized text.");
  if (!documentDate) {
    warnings.push(
      hasAmbiguousNumericDate(text)
        ? "A numeric date is ambiguous; it was left blank for manual review."
        : "Document date was not detected from the recognized text.",
    );
  }
  if (classification.confidence < 0.65) {
    warnings.push("Document category is uncertain. Please verify it before saving.");
  }

  /*
   * Certificate-specific extraction.
   * If the OCR contains strong certificate wording,
   * classify it as certificate even when another keyword
   * accidentally wins.
   */
  let category = classification.category;

  if (
    /certificate|certification|successfully\s+completed|certificate\s+of/i.test(
      text,
    )
  ) {
    category = 'certificate';
  }

  // Strong academic headings take priority over incidental certificate words.
  if (/statement\s+of\s+marks|marks?\s*sheet|semester\s+marksheet/i.test(text)) category = 'marksheet';
  else if (/grade\s*card|grade\s*sheet/i.test(text)) category = 'grade_card';

  let finalTitle = title;
  let finalCertificateId = certificateId;
  let finalSkills = skills;
  if (['marksheet','grade_card','transcript','academic_letter','degree','other'].includes(category)) {
    if (category === 'marksheet') finalTitle = semester ? `Semester ${semester} Marksheet` : 'Semester Marksheet';
    else if (category === 'grade_card') finalTitle = semester ? `Semester ${semester} Grade Card` : 'Grade Card';
    else if (category === 'transcript') finalTitle = 'Academic Transcript';
    else if (category === 'academic_letter') finalTitle = 'Academic Letter';
    else if (category === 'degree') finalTitle = 'Degree Document';
    finalCertificateId = undefined;
    finalSkills = [];
  }
  if (!finalTitle) warnings.push('Relevant document title was not detected automatically. Please enter the title manually.');
  if (category === 'certificate' && !finalCertificateId) warnings.push('Certificate or credential ID was not detected.');
  if (["certificate", "internship", "achievement"].includes(category) && !holder.value) {
    warnings.push("Holder name was not detected from an explicit label; enter it manually if needed.");
  }

  return {
    text,
    category,
    confidence: classification.confidence,
    extraction,
    holderName: holder.value,
    grades,
    fieldEvidence: {
      title: finalTitle ? "text-pattern" : "not-detected",
      category: classification.confidence ? "text-pattern" : "not-detected",
      holderName: holder.source,
      institution: institution ? "text-pattern" : "not-detected",
      documentDate: documentDate ? "text-pattern" : "not-detected",
      certificateId: finalCertificateId ? "explicit-label" : "not-detected",
      semester: semester ? "explicit-label" : "not-detected",
      academicYear: academicYear ? "text-pattern" : "not-detected",
      courseName: courseName ? "text-pattern" : "not-detected",
      skills: finalSkills.length ? "text-pattern" : "not-detected",
      grades: grades.length ? "explicit-label" : "not-detected",
    },
    title: finalTitle,
    institution,
    documentDate,
    certificateId: finalCertificateId,
    academicYear,
    semester,
    courseName,
    skills: finalSkills,
    warnings,
  };
}