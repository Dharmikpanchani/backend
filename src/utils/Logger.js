import winston, { createLogger, format, transports } from 'winston';
import { inspect } from 'util';
import DailyRotateFile from 'winston-daily-rotate-file';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
    trace: 7,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey',
    trace: 'white',
  },
};

// Add custom colors
winston.addColors(customLevels.colors);

const loggerConfig = {
  CONSOLE_LOGGER_LEVEL: 'info',
  LOGGER_LEVEL: 'trace',
};

const myFormat = format.printf(
  ({ level, message, label, timestamp }) =>
    `${timestamp} | ${label} | ${level} : ${message}`
);

// Make the LEVEL capitalize in logs
const capitalizeLevel = format((info) => {
  info.level = info.level.toUpperCase();
  return info;
})();

// Transports to save the logs to
const errorLogs = new transports.File({
  filename: 'logs/error.log',
  level: 'error',
});

// Date-wise logs
const dateWise = new DailyRotateFile({
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  dirname: 'logs',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '60d',
});

const combinedLogs = new transports.File({ filename: `logs/combine.log` });

const logger = createLogger({
  levels: customLevels.levels,
  level: loggerConfig.LOGGER_LEVEL,
  format: format.combine(
    capitalizeLevel,
    format.timestamp(),
    format.colorize({ all: true }), // Apply colorize last
    myFormat
  ),
  transports: [errorLogs, dateWise, combinedLogs],
  exitOnError: false,
});

logger.add(
  new transports.Console({
    format: format.combine(format.colorize(), myFormat),
    handleExceptions: true,
    level: loggerConfig.CONSOLE_LOGGER_LEVEL,
  })
);

/**
 * Class `Logger` for application logging service.
 */
class Logger {
  #meta;

  constructor(moduleName) {
    this.#meta = {
      label: moduleName,
    };
  }

  createMessage(...args) {
    return args
      .map((logElement) =>
        typeof logElement === 'string'
          ? logElement
          : inspect(logElement, false, 10, false)
      )
      .join(' ');
  }

  log(logLevel, ...args) {
    const message = this.createMessage(...args);
    logger.log(logLevel, message, this.#meta);
  }

  debug(...args) {
    this.log('debug', ...args);
  }

  error(...args) {
    this.log('error', ...args);
  }

  warn(...args) {
    this.log('warn', ...args);
  }

  info(...args) {
    this.log('info', ...args);
  }

  verbose(...args) {
    this.log('verbose', ...args);
  }

  trace(...args) {
    this.log('trace', ...args);
  }

  silly(...args) {
    this.log('silly', ...args);
  }
}

export default Logger;
