import * as vscode from 'vscode';
import { LoggerAdapter } from 'wfnodeserver';

/**
 * Custom logger adapter that redirects WFNodeServer logs to VS Code's output channel
 */
export class VscodeLoggerAdapter implements LoggerAdapter {
    private outputChannel: vscode.OutputChannel;

    constructor(channelName: string = 'WFNodeServer') {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }
    log(options: { level: string; message: string; metadata?: any; }): void {
        const { level, message, metadata } = options;
        const formattedMessage = this.formatMessage(level.toUpperCase(), message, [metadata]);
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
    }

    /**
     * Log info level messages
     */
    public info(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('INFO', message, args);
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
    }

    /**
     * Log warn level messages
     */
    public warn(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('WARN', message, args);
        console.warn(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
    }

    /**
     * Log error level messages
     */
    public error(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('ERROR', message, args);
        console.error(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
    }

    /**
     * Log debug level messages
     */
    public debug(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('DEBUG', message, args);
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
    }

    /**
     * Log verbose level messages
     */
    public verbose(message: string, ...args: any[]): void {
        const formattedMessage = this.formatMessage('VERBOSE', message, args);
        console.log(formattedMessage);
        this.outputChannel.appendLine(formattedMessage);
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
     * Format log messages with timestamp and level
     */
    private formatMessage(level: string, message: string, args: any[]): string {
        const timestamp = new Date().toISOString();
        const argsString = args.length > 0 ? ' ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ') : '';
        
        return `${timestamp} [${level}]: ${message}${argsString}`;
    }
}
