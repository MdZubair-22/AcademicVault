/** Shared mobile-friendly search helpers. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchableValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(searchableValue).join(' ');
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(searchableValue).join(' ');
  return String(value ?? '');
}

export function matchesSearch(value: unknown, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(searchableValue(value)).includes(needle);
}

export function matchesFields(row: unknown, fields: string[], query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  return fields.some((field) => matchesSearch(record[field], needle));
}
