export function sanitizeUrdfName(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  const safe = normalized.length > 0 ? normalized : fallback;
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
}

export function uniqueUrdfName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  const result = `${base}_${suffix}`;
  used.add(result);
  return result;
}
