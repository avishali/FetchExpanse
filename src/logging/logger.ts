
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const levels = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const currentLevel = levels[(process.env.LOG_LEVEL || 'info').toLowerCase() as keyof typeof levels] || LogLevel.INFO;

function log(level: LogLevel, message: string, meta?: any) {
  if (level < currentLevel) return;

  const timestamp = new Date().toISOString();
  const levelName = LogLevel[level];
  const output = {
    timestamp,
    level: levelName,
    message,
    ...meta,
  };
  console.log(JSON.stringify(output));
}

export const logger = {
  debug: (message: string, meta?: any) => log(LogLevel.DEBUG, message, meta),
  info: (message: string, meta?: any) => log(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: any) => log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: any) => log(LogLevel.ERROR, message, meta),
};
