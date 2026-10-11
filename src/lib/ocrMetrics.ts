function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function editDistance<T>(expected: T[], actual: T[]): number {
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row++) {
    const current = [row];
    for (let column = 1; column <= actual.length; column++) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] +
          (expected[row - 1] === actual[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[actual.length];
}

function errorRate(expected: string, actual: string, words: boolean): number | null {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  const expectedUnits = words
    ? normalizedExpected.split(" ").filter(Boolean)
    : Array.from(normalizedExpected);
  const actualUnits = words
    ? normalizedActual.split(" ").filter(Boolean)
    : Array.from(normalizedActual);

  if (expectedUnits.length === 0) {
    return actualUnits.length === 0 ? 0 : null;
  }
  return editDistance(expectedUnits, actualUnits) / expectedUnits.length;
}

export function characterErrorRate(expected: string, actual: string): number | null {
  return errorRate(expected, actual, false);
}

export function wordErrorRate(expected: string, actual: string): number | null {
  return errorRate(expected, actual, true);
}

export function exactFieldAccuracy(
  expected: Record<string, string | null>,
  actual: Record<string, string | null>,
): number | null {
  const fields = Object.keys(expected);
  if (!fields.length) return null;
  const matches = fields.filter(
    (field) => normalizeText(expected[field] ?? "") === normalizeText(actual[field] ?? ""),
  ).length;
  return matches / fields.length;
}

export function classificationAccuracy(
  expected: string[],
  actual: string[],
): number | null {
  if (!expected.length || expected.length !== actual.length) return null;
  const correct = expected.filter(
    (category, index) => normalizeText(category) === normalizeText(actual[index] ?? ""),
  ).length;
  return correct / expected.length;
}

export function summarizeProcessing(
  elapsedMs: number[],
  failedCount: number,
): { averageMs: number | null; failureRate: number | null } {
  const averageMs = elapsedMs.length
    ? elapsedMs.reduce((sum, value) => sum + value, 0) / elapsedMs.length
    : null;
  const total = elapsedMs.length + failedCount;
  return {
    averageMs,
    failureRate: total ? failedCount / total : null,
  };
}
