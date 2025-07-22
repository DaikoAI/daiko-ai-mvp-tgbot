const getTimestamp = () => {
  return new Date().toISOString();
};

export const logger = {
  log: (...args: unknown[]) => {
    console.log(`[${getTimestamp()}]`, ...args);
  },
  info: (...args: unknown[]) => {
    console.info(`[${getTimestamp()}]`, ...args);
  },
  debug: (...args: unknown[]) => {
    console.debug(`[${getTimestamp()}]`, ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(`[${getTimestamp()}]`, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(`[${getTimestamp()}]`, ...args);
  },
};
