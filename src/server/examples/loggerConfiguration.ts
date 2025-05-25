import { VscodeWFLoggerAdapter, LoggerAdapter } from '../adapters/VscodeWFLoggerAdapter';
import { configurableLogger, configureLogger } from '../utils/configurableLogger';
import { WFServer } from '../adapters/WFServerSetup';

/**
 * Examples demonstrating how to configure and use the logger adapter system
 */

/**
 * Example 1: Basic usage with the default console logger
 */
export function basicLoggingExample(): void {
  console.log('=== Basic Logging Example ===');
  
  // Use the configurable logger - defaults to console logging
  configurableLogger.info('Application started');
  configurableLogger.warn('This is a warning message');
  configurableLogger.error('An error occurred', { errorCode: 500 });
  configurableLogger.debug('Debug information', { userId: '12345', action: 'login' });
}

/**
 * Example 2: Configure with VS Code logger adapter
 */
export function vscodeLoggerExample(): void {
  console.log('=== VS Code Logger Example ===');
  
  // Create a VS Code logger adapter
  const vscodeAdapter = new VscodeWFLoggerAdapter('My Application Logger', false);
  
  // Configure the global logger
  configureLogger(vscodeAdapter);
  
  // Now all logging will use the VS Code output channel
  configurableLogger.info('This will be logged to VS Code output channel');
  configurableLogger.warn('Warning logged to VS Code', { timestamp: new Date() });
  configurableLogger.error('Error with metadata', { 
    error: 'Database connection failed', 
    retries: 3,
    lastAttempt: new Date()
  });
  
  // Show the output channel
  vscodeAdapter.show();
}

/**
 * Example 3: Custom logger implementation
 */
export class CustomLoggerAdapter implements LoggerAdapter {
  private logs: Array<{ level: string; message: string; metadata?: any; timestamp: Date }> = [];

  debug(message: string, metadata?: any): void {
    this.logToMemory('DEBUG', message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.logToMemory('INFO', message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.logToMemory('WARN', message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.logToMemory('ERROR', message, metadata);
  }

  log(options: { level: string; message: string; metadata?: any }): void {
    this.logToMemory(options.level, options.message, options.metadata);
  }

  private logToMemory(level: string, message: string, metadata?: any): void {
    this.logs.push({
      level,
      message,
      metadata,
      timestamp: new Date()
    });
    
    // Also log to console for demonstration
    console.log(`[MEMORY-${level}] ${message}`, metadata || '');
  }

  /**
   * Get all logs stored in memory
   */
  public getLogs(): Array<{ level: string; message: string; metadata?: any; timestamp: Date }> {
    return [...this.logs];
  }

  /**
   * Clear all logs from memory
   */
  public clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Example 4: Using a custom logger implementation
 */
export function customLoggerExample(): void {
  console.log('=== Custom Logger Example ===');
  
  // Create a custom logger adapter
  const customAdapter = new CustomLoggerAdapter();
  
  // Configure the global logger
  configureLogger(customAdapter);
  
  // Use the logger
  configurableLogger.info('Custom logger test');
  configurableLogger.warn('This stores logs in memory');
  configurableLogger.error('Error with custom adapter', { customField: 'value' });
  
  // Access the stored logs
  const logs = customAdapter.getLogs();
  console.log('Stored logs:', logs);
  
  // Clear the logs
  customAdapter.clearLogs();
}

/**
 * Example 5: Using with WF Server Setup
 */
export function wfServerLoggerExample(): void {
  console.log('=== WF Server Logger Example ===');
  
  // The WF Server automatically configures logging when started
  // You can access the configured logger adapters
  const wfLoggerAdapter = WFServer.getWFLoggerAdapter();
  const nodeServerLoggerAdapter = WFServer.getLoggerAdapter();
  
  // Use the WF Utilities logger directly
  configurableLogger.info('This will use the WF Server configured logger');
  
  // Show the WF Utilities logs
  WFServer.showWFUtilitiesLogs();
  
  // Show all logs (both WF Utilities and Node Server)
  WFServer.showAllLogs();
}

/**
 * Example 6: Runtime logger switching
 */
export function loggerSwitchingExample(): void {
  console.log('=== Logger Switching Example ===');
  
  // Start with VS Code logger
  const vscodeAdapter = new VscodeWFLoggerAdapter('Switching Demo', false);
  configureLogger(vscodeAdapter);
  
  configurableLogger.info('Using VS Code logger');
  
  // Switch to custom logger
  const customAdapter = new CustomLoggerAdapter();
  configureLogger(customAdapter);
  
  configurableLogger.info('Now using custom logger');
  configurableLogger.warn('This is stored in memory');
  
  // Switch back to VS Code logger
  configureLogger(vscodeAdapter);
  
  configurableLogger.info('Back to VS Code logger');
  
  // Show the logs from the custom adapter
  console.log('Custom adapter stored logs:', customAdapter.getLogs());
}

/**
 * Run all examples
 */
export function runAllLoggerExamples(): void {
  basicLoggingExample();
  console.log('\n');
  
  vscodeLoggerExample();
  console.log('\n');
  
  customLoggerExample();
  console.log('\n');
  
  wfServerLoggerExample();
  console.log('\n');
  
  loggerSwitchingExample();
  console.log('\n');
  
  console.log('All logger examples completed!');
}
