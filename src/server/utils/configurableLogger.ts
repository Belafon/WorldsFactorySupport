import { LoggerAdapter, DefaultLoggerAdapter } from '../adapters/VscodeWFLoggerAdapter';

/**
 * Runtime-configurable logger that uses the adapter from configuration
 * This allows the logging behavior to be changed at runtime by setting a different adapter
 */
class ConfigurableLogger {
  private adapter: LoggerAdapter = new DefaultLoggerAdapter();

  /**
   * Set the logger adapter to use
   * @param adapter The logger adapter implementation
   */
  public setAdapter(adapter: LoggerAdapter): void {
    if (!adapter) {
      throw new Error('Logger adapter cannot be null or undefined');
    }
    this.adapter = adapter;
  }

  /**
   * Get the current logger adapter
   */
  public getAdapter(): LoggerAdapter {
    return this.adapter;
  }

  /**
   * Reset to default console logger
   */
  public reset(): void {
    this.adapter = new DefaultLoggerAdapter();
  }

  /**
   * Log a debug message
   */
  public debug(message: string, metadata?: any): void {
    this.adapter.debug(message, metadata);
  }

  /**
   * Log an info message
   */
  public info(message: string, metadata?: any): void {
    this.adapter.info(message, metadata);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, metadata?: any): void {
    this.adapter.warn(message, metadata);
  }

  /**
   * Log an error message
   */
  public error(message: string, metadata?: any): void {
    this.adapter.error(message, metadata);
  }

  /**
   * Log a message with specified level
   */
  public log(options: { level: string; message: string; metadata?: any }): void {
    this.adapter.log(options);
  }
}

// Create a singleton instance for use throughout the application
export const configurableLogger = new ConfigurableLogger();

/**
 * Configure the global logger with a specific adapter
 * @param adapter The logger adapter to use
 */
export function configureLogger(adapter: LoggerAdapter): void {
  configurableLogger.setAdapter(adapter);
}

/**
 * Get the current logger adapter
 */
export function getLoggerAdapter(): LoggerAdapter {
  return configurableLogger.getAdapter();
}
