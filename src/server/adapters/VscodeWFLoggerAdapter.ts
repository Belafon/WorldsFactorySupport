import * as vscode from 'vscode';

/**
 * Interface for logger operations
 * Implementations will handle specific logging integrations (winston, console, etc.)
 */
export interface LoggerAdapter {
  /**
   * Logs a debug message
   * @param message The message to log
   * @param metadata Optional metadata to include with the log
   */
  debug(message: string, metadata?: any): void;
  
  /**
   * Logs an info message
   * @param message The message to log
   * @param metadata Optional metadata to include with the log
   */
  info(message: string, metadata?: any): void;
  
  /**
   * Logs a warning message
   * @param message The message to log
   * @param metadata Optional metadata to include with the log
   */
  warn(message: string, metadata?: any): void;
  
  /**
   * Logs an error message
   * @param message The message to log
   * @param metadata Optional metadata to include with the log
   */
  error(message: string, metadata?: any): void;
  
  /**
   * Logs a message with specified level
   * @param level The log level
   * @param message The message to log
   * @param metadata Optional metadata to include with the log
   */
  log(options: { level: string; message: string; metadata?: any }): void;
}

/**
 * VS Code logger adapter that implements the WF Utilities LoggerAdapter interface
 * This bridges the WF Utilities logging system to VS Code's output channel
 */
export class VscodeWFLoggerAdapter implements LoggerAdapter {
  private outputChannel: vscode.OutputChannel;
  private showOutputOnLog: boolean;

  constructor(channelName: string = 'WF Utilities', showOutputOnLog: boolean = false) {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.showOutputOnLog = showOutputOnLog;
  }

  /**
   * Logs a debug message
   */
  public debug(message: string, metadata?: any): void {
    const formattedMessage = this.formatMessage('DEBUG', message, metadata);
    console.debug(formattedMessage);
    this.outputChannel.appendLine(formattedMessage);
    this.conditionallyShowOutput();
  }

  /**
   * Logs an info message
   */
  public info(message: string, metadata?: any): void {
    const formattedMessage = this.formatMessage('INFO', message, metadata);
    console.info(formattedMessage);
    this.outputChannel.appendLine(formattedMessage);
    this.conditionallyShowOutput();
  }

  /**
   * Logs a warning message
   */
  public warn(message: string, metadata?: any): void {
    const formattedMessage = this.formatMessage('WARN', message, metadata);
    console.warn(formattedMessage);
    this.outputChannel.appendLine(formattedMessage);
    this.conditionallyShowOutput();
  }

  /**
   * Logs an error message
   */
  public error(message: string, metadata?: any): void {
    const formattedMessage = this.formatMessage('ERROR', message, metadata);
    console.error(formattedMessage);
    this.outputChannel.appendLine(formattedMessage);
    this.conditionallyShowOutput();
  }

  /**
   * Logs a message with specified level
   */
  public log(options: { level: string; message: string; metadata?: any }): void {
    const { level, message, metadata } = options;
    const formattedMessage = this.formatMessage(level.toUpperCase(), message, metadata);
    console.log(formattedMessage);
    this.outputChannel.appendLine(formattedMessage);
    this.conditionallyShowOutput();
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose of the output channel
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * Set whether to automatically show output channel on log messages
   */
  public setShowOutputOnLog(show: boolean): void {
    this.showOutputOnLog = show;
  }

  /**
   * Format log messages with timestamp and level
   */
  private formatMessage(level: string, message: string, metadata?: any): string {
    const timestamp = new Date().toISOString();
    const metadataString = metadata ? ` ${this.formatMetadata(metadata)}` : '';
    return `${timestamp} [${level}]: ${message}${metadataString}`;
  }

  /**
   * Format metadata for logging
   */
  private formatMetadata(metadata: any): string {
    if (metadata === null || metadata === undefined) {
      return '';
    }
    
    if (typeof metadata === 'string') {
      return metadata;
    }
    
    if (typeof metadata === 'object') {
      try {
        return JSON.stringify(metadata, null, 2);
      } catch (error) {
        return '[Object - could not stringify]';
      }
    }
    
    return String(metadata);
  }

  /**
   * Conditionally show the output channel if configured to do so
   */
  private conditionallyShowOutput(): void {
    if (this.showOutputOnLog) {
      this.outputChannel.show(true); // true = preserve focus
    }
  }
}

/**
 * Default implementation of LoggerAdapter
 * Uses console logging as fallback when no specific logger is configured
 */
export class DefaultLoggerAdapter implements LoggerAdapter {
  debug(message: string, metadata?: any): void {
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    console.debug(`[DEBUG] ${message}${metadataStr}`);
  }

  info(message: string, metadata?: any): void {
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    console.info(`[INFO] ${message}${metadataStr}`);
  }

  warn(message: string, metadata?: any): void {
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    console.warn(`[WARN] ${message}${metadataStr}`);
  }

  error(message: string, metadata?: any): void {
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    console.error(`[ERROR] ${message}${metadataStr}`);
  }

  log(options: { level: string; message: string; metadata?: any }): void {
    const { level, message, metadata } = options;
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    console.log(`[${level.toUpperCase()}] ${message}${metadataStr}`);
  }
}
