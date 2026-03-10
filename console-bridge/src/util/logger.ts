const LEVEL_ORDER = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

export type LogLevel = keyof typeof LEVEL_ORDER;

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

function serializeMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }
  return ` ${JSON.stringify(meta)}`;
}

export function createLogger(level: LogLevel = "info"): Logger {
  const current = LEVEL_ORDER[level];

  function write(target: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[target] < current) {
      return;
    }

    const line = `${new Date().toISOString()} [${target.toUpperCase()}] ${message}${serializeMeta(meta)}`;
    if (target === "warn") {
      console.warn(line);
      return;
    }
    if (target === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  }

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}
