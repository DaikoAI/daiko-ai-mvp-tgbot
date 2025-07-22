/**
 * Safely parses numeric values from strings, handling null/undefined/empty values and NaN
 * @param value - String value to parse (from database or external source)
 * @returns Parsed number if valid, null if invalid/empty
 */
export const safeParseNumber = (value: string | null | undefined): number | null => {
  if (!value || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
