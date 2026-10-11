export type HolderNameExtraction = {
  value?: string;
  source: "explicit-label" | "not-detected";
};

export function extractHolderName(text: string): HolderNameExtraction {
  const patterns = [
    /(?:student\s+name|candidate\s+name|name\s+of\s+(?:the\s+)?student|name\s*[:\-]|recipient\s*[:\-]|awardee\s*[:\-]|awarded\s+to|issued\s+to|presented\s+to|conferred\s+upon|this\s+is\s+to\s+certify\s+that|certificate\s+awarded\s+to|certified\s+to)\s*[:\-]?\s*([A-Z][A-Za-z0-9][A-Za-z0-9 .'-]{1,68})/i,
    /(?:name|student\s+name|candidate\s+name)\s*[:\-]\s*([A-Z][A-Za-z0-9][A-Za-z0-9 .'-]{1,68})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    let value = match[1]
      .split(/\b(?:has|who|for|upon|in\s+recognition|received|completed|secured|passed)\b/i)[0]
      .replace(/\s+/g, " ")
      .replace(/^[\s:;,\-.]+|[\s:;,\-.]+$/g, "")
      .trim();

    if (!value) continue;

    value = value.replace(/\s+\b(?:for|in|with|on)\b.*$/i, "").trim();

    if (
      /university|college|institute|institution|academy|school|organization|organisation|technologies|technology|foundation|company|corporation|ltd|limited|inc|coursera|udemy|google|microsoft|ibm|nptel|infosys|tcs|accenture|aws|oracle|cisco|linkedin/i.test(value) ||
      /^(this|certificate|certification|completion|participation|award|achievement|student|candidate|recipient|name)$/i.test(value) ||
      value.split(/\s+/).length > 7 ||
      value.length < 3
    ) {
      continue;
    }

    return { value, source: "explicit-label" };
  }

  return { source: "not-detected" };
}

export function extractGrades(text: string): string[] {
  const values = [...text.matchAll(
    /\b(CGPA|GPA|percentage|aggregate|marks\s+obtained|total\s+marks|grade)\s*[:= -]?\s*((?:\d{1,3}(?:\.\d{1,2})?\s*%?)|(?:[A-F][+-]?)|(?:O))(?=$|[\s,;.)])/gi,
  )].map((match) => `${match[1]}: ${match[2].trim()}`);
  return [...new Set(values)].slice(0, 20);
}

export function cleanOCRTitle(value?: string): string | undefined {
  const cleaned = value
    ?.replace(/\s+/g, ' ')
    .replace(/^[\s:;,\-.]+/, '')
    .replace(/[\s:;,\-.]+$/, '')
    .trim();

  if (!cleaned) return undefined;
  if (/^(?:this\s+is\s+to\s+certify|certificate(?:\s+of\s+(?:completion|participation|achievement))?|completion(?:\s+certificate)?|participation(?:\s+certificate)?|achievement(?:\s+certificate)?|merit|appreciation|excellence|certification|course|training|program|programme)$/i.test(cleaned)) return undefined;
  return cleaned;
}
