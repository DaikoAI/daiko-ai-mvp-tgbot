enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
  LOG = "LOG",
}

const getTimestamp = () => {
  return new Date().toISOString();
};

const colorize = (message: string, level: LogLevel): string => {
  const colors = {
    [LogLevel.ERROR]: "\x1b[31m", // Red
    [LogLevel.WARN]: "\x1b[33m", // Yellow
    [LogLevel.INFO]: "\x1b[36m", // Cyan
    [LogLevel.DEBUG]: "\x1b[32m", // Green
    [LogLevel.LOG]: null, // No color (standard)
  };

  const reset = "\x1b[0m";
  const color = colors[level];

  if (color === null) {
    return message; // No color for LOG
  }

  return `${color}${message}${reset}`;
};

const formatMessage = (level: LogLevel, ...args: unknown[]): string => {
  const timestamp = `[${getTimestamp()}]`;
  const levelTag = `[${level}]`;
  const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
  const fullMessage = `${timestamp} ${levelTag} ${message}`;

  return colorize(fullMessage, level);
};

export const logger = {
  log: (...args: unknown[]) => {
    console.log(formatMessage(LogLevel.LOG, ...args));
  },
  info: (...args: unknown[]) => {
    console.info(formatMessage(LogLevel.INFO, ...args));
  },
  debug: (...args: unknown[]) => {
    console.debug(formatMessage(LogLevel.DEBUG, ...args));
  },
  warn: (...args: unknown[]) => {
    console.warn(formatMessage(LogLevel.WARN, ...args));
  },
  error: (...args: unknown[]) => {
    console.error(formatMessage(LogLevel.ERROR, ...args));
  },
};
