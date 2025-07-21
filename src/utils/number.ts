// Helper function to safely parse numeric values and validate
export const safeParseNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return !isNaN(parsed) && Number.isFinite(parsed) ? parsed : null;
};

// Helper function to safely parse numeric values
export const safeParseFloat = (value: string | null | undefined, fallback?: number): number | undefined => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = parseFloat(value);
  return !isNaN(parsed) && Number.isFinite(parsed) ? parsed : fallback;
};
