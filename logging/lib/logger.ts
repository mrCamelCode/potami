import { Event } from '../../deps.ts';

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export type LogEventHandler = (formattedLog: string, logLevel: LogLevel) => void;

const longestLogLevelName = Math.max(...Object.values(LogLevel).map((value) => value.length));

export interface LoggerOptions {
  /**
   * A mapping of log levels to priority. This determines how the `logLevel` of the Logger impacts what
   * log requests actually make it to the standard output. It's recommended you leave this at its default.
   *
   * The lower the number the less important the level is. For example, if the current log level is at a level
   * that represents a priority of 20, only logs that represent a priority >=20 will be logged. Any logs with
   * priority <20 will be ignored.
   *
   * Defaults to:
   * ```ts
   * {
   *    [LogLevel.Debug]: 10,
   *    [LogLevel.Info]: 20,
   *    [LogLevel.Warn]: 30,
   *    [LogLevel.Error]: 40,
   *  }
   * ```
   */
  logLevelToPriority?: Record<LogLevel, number>;
  /**
   * A mapping of log levels to strings representing colors. These colors may be any valid CSS color.
   *
   * Defaults to:
   * ```ts
   * {
   *    [LogLevel.Debug]: '#91defa', // light blue
   *    [LogLevel.Info]: '#ffffff', // white
   *    [LogLevel.Warn]: '#ff833b', // orange
   *    [LogLevel.Error]: '#ff386a', // red
   *  }
   * ```
   *
   * @example
   * ```ts
   * 'red'
   * '#FFC0CB'
   * 'rgb(255, 255, 255)'
   * ```
   */
  logLevelToColor?: Record<LogLevel, string>;
}

/**
 * Provides a customizable means by which to log to the standard output in an organized and consistent fashion.
 * Via the `logLevel`, you can also control what logging calls actually produce a log.
 *
 * While you're free to create any number of Logger instances you'd like, it's recommended to create and use
 * a single instance throughout your application, especially since a logger is likely to be a component used throughout
 * your entire application at all levels.
 */
export class Logger {
  static readonly DEFAULT_OPTIONS: Required<LoggerOptions> = {
    logLevelToPriority: {
      [LogLevel.Debug]: 10,
      [LogLevel.Info]: 20,
      [LogLevel.Warn]: 30,
      [LogLevel.Error]: 40,
    },
    logLevelToColor: {
      [LogLevel.Debug]: '#91defa', // light blue
      [LogLevel.Info]: '#ffffff', // white
      [LogLevel.Warn]: '#ff833b', // orange
      [LogLevel.Error]: '#ff386a', // red
    },
  };

  /**
   * Triggered after a log is actually produced. This ONLY triggers when a call to log something passes the current
   * log level and produces a log to the standard output.
   */
  onLogged: Event<LogEventHandler> = new Event();
  /**
   * Triggered when a log call was made, but the current log level stopped the log from making it to the standard
   * output.
   */
  onIgnoredLog: Event<LogEventHandler> = new Event();
  /**
   * Triggered when any call to log is made, regardless of whether the log actually made it to the standard output.
   */
  onReceivedLog: Event<LogEventHandler> = new Event();

  #options: Required<LoggerOptions>;

  constructor(public logLevel = LogLevel.Info, options: LoggerOptions = {}) {
    this.#options = {
      logLevelToPriority: {
        ...Logger.DEFAULT_OPTIONS.logLevelToPriority,
        ...options?.logLevelToPriority,
      },
      logLevelToColor: {
        ...Logger.DEFAULT_OPTIONS.logLevelToColor,
        ...options?.logLevelToColor,
      },
      ...options,
    };
  }

  debug(msg: string): void {
    this.#log(msg, LogLevel.Debug);
  }

  info(msg: string): void {
    this.#log(msg, LogLevel.Info);
  }

  warn(msg: string): void {
    this.#log(msg, LogLevel.Warn);
  }

  error(msg: string): void {
    this.#log(msg, LogLevel.Error);
  }

  #log(msg: string, logLevel: LogLevel): void {
    const prettyMsg = [new Date().toISOString().padEnd(30), `[${logLevel.padEnd(longestLogLevelName)}]:  `, msg].join(
      ''
    );

    this.onReceivedLog.trigger(prettyMsg, logLevel);

    if (this.#shouldLogAtLevel(logLevel)) {
      const { logLevelToColor } = this.#options;
      const logColor = logLevelToColor[logLevel];

      console.log(`%c${prettyMsg}`, `color: ${logColor}`);

      this.onLogged.trigger(prettyMsg, logLevel);
    } else {
      this.onIgnoredLog.trigger(prettyMsg, logLevel);
    }
  }

  #shouldLogAtLevel(logLevel: LogLevel): boolean {
    const { logLevelToPriority } = this.#options;

    const desiredPriority = logLevelToPriority[this.logLevel];
    const logPriority = logLevelToPriority[logLevel];

    return logPriority >= desiredPriority;
  }
}
