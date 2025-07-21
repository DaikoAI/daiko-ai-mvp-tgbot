// Helper function to safely parse numeric values and validate
export const safeParseNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return !isNaN(parsed) && Number.isFinite(parsed) ? parsed : null;
};
