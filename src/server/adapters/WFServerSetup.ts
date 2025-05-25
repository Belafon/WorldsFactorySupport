import {
  wfNodeServerConfig as wfConfig,
  createServer,
  EditorAdapter as WFEditorAdapterInterface, // Import the interface type
  IFileSystem as WFFileSystemInterface     // Import the interface type
} from 'wfnodeserver';
import { VscodeEditorAdapter } from './VscodeEditorAdapter';
import { VscodeFileSystemAdapter } from './VscodeFileSystemAdapter';
import { VscodeWorkspaceAdapter } from './VscodeWorkspaceAdapter';
import { VscodeLoggerAdapter } from './VscodeLoggerAdapter';
import { VscodeWFLoggerAdapter, LoggerAdapter } from './VscodeWFLoggerAdapter';
import { configurableLogger, configureLogger } from '../utils/configurableLogger';
import type { Server as HttpServer } from 'http'; // For typing the server instance

export class WFServerSetup {
  private serverInstance: HttpServer | null = null;
  private isConfigured: boolean = false;
  private loggerAdapter: VscodeLoggerAdapter;
  private wfLoggerAdapter: VscodeWFLoggerAdapter;

  constructor() { 
    this.loggerAdapter = new VscodeLoggerAdapter('WFNodeServer');
    this.wfLoggerAdapter = new VscodeWFLoggerAdapter('WF Utilities', false);
  }

  /**
   * Configures the WFNodeServer library with VS Code specific adapters.
   * This method should be called before starting the server if custom adapters are needed.
   */
  public configureAdapters(): void {
    if (this.isConfigured) {
      console.warn('[WFServerSetup] Adapters already configured. Skipping.');
      return;
    }

    const editorAdapter = new VscodeEditorAdapter();
    const fileSystemAdapter = new VscodeFileSystemAdapter();
    const workspaceAdapter = new VscodeWorkspaceAdapter();

    wfConfig.setEditorAdapter(editorAdapter);
    console.log('[WFServerSetup] Custom EditorAdapter set.');
    this.loggerAdapter.info('Custom EditorAdapter set.');

    wfConfig.setWorkspaceAdapter(workspaceAdapter);
    console.log('[WFServerSetup] Custom WorkspaceAdapter set.');
    this.loggerAdapter.info('Custom WorkspaceAdapter set.');

    // Configure the WF Utilities logger with VS Code adapter
    this.configureWFUtilitiesLogger();

    // IMPORTANT: Addressing the sync/async mismatch for FileSystem
    // The VscodeFileSystemAdapter uses async methods due to VS Code's async FS API.
    // The WFNodeServer's IFileSystem interface expects synchronous methods.
    // This line will cause a type error if `WFFileSystemInterface` has strict sync signatures
    // and `VscodeFileSystemAdapter` has async signatures (e.g. `Promise<string>` vs `string`).
    //
    // To make this work, you would typically:
    // 1. Modify WFNodeServer to accept an asynchronous FileSystem adapter interface.
    // 2. Or, if WFNodeServer *can* somehow handle promises returned by these methods
    //    (unlikely without internal async/await), you might cast:
    //    `wfConfig.setFileSystem(fileSystemAdapter as any as WFFileSystemInterface);`
    //    This bypasses type checking and relies on the library's internals.
    //
    // For now, we'll assume you'll handle the type discrepancy or modify the library.
    // If direct assignment fails due to type mismatch (sync vs async methods),
    // you'd need to cast `fileSystemAdapter as any` or similar, understanding the risks.
    try {
      wfConfig.setFileSystem(fileSystemAdapter as any as WFFileSystemInterface);
      // The `as any as WFFileSystemInterface` is a strong type assertion to bypass
      // the likely mismatch between the synchronous interface and our async adapter.
      // This is a workaround and indicates a fundamental incompatibility that
      // ideally should be resolved by making WFNodeServer's IFileSystem async-aware.
      console.log('[WFServerSetup] Custom FileSystemAdapter set (with potential sync/async mismatch).');
      this.loggerAdapter.info('Custom FileSystemAdapter set (with potential sync/async mismatch).');
    } catch (error) {
      console.error('[WFServerSetup] Error setting FileSystemAdapter. This is likely due to the sync/async incompatibility:', error);
      console.error('[WFServerSetup] The VscodeFileSystemAdapter is async, but WFNodeServer likely expects a sync IFileSystem.');
      this.loggerAdapter.error('Error setting FileSystemAdapter. This is likely due to the sync/async incompatibility:', error);
      this.loggerAdapter.error('The VscodeFileSystemAdapter is async, but WFNodeServer likely expects a sync IFileSystem.');
      // Optionally re-throw or handle this critical configuration failure
    }

    this.isConfigured = true;
  }

  /**
   * Configures WF Utilities library logging to use VS Code output channel
   */
  private configureWFUtilitiesLogger(): void {
    try {
      // Configure the global configurable logger with our VS Code adapter
      configureLogger(this.wfLoggerAdapter);
      
      console.log('[WFServerSetup] WF Utilities logger configured with VS Code adapter.');
      this.loggerAdapter.info('WF Utilities logger configured with VS Code adapter.');
      
      // Test the configuration
      configurableLogger.info('WF Utilities logger successfully configured for VS Code');
      
      // If the WF library config supports setting a logger adapter, configure it too
      if (typeof (wfConfig as any).setLoggerAdapter === 'function') {
        (wfConfig as any).setLoggerAdapter(this.wfLoggerAdapter);
        this.loggerAdapter.info('WF Utilities library logger adapter set on wfConfig.');
      } else {
        this.loggerAdapter.info('WF Utilities config does not expose setLoggerAdapter method. Using global configurable logger.');
      }
    } catch (error) {
      console.error('[WFServerSetup] Error configuring WF Utilities logger:', error);
      this.loggerAdapter.error('Error configuring WF Utilities logger:', error);
    }
  }

  /**
   * Starts the WFNodeServer.
   * If adapters have not been configured, it will configure them with VS Code defaults first.
   * @param port The port number for the server to listen on. Defaults to 3000.
   * @returns A Promise that resolves with the server instance when started, or rejects on error.
   */
  public async startServer(port: number = 3123): Promise<HttpServer> {
    if (this.serverInstance) {
      const address = this.serverInstance.address();
      const port = typeof address === 'string' ? address : address?.port;
      console.warn(`[WFServerSetup] Server is already running on port ${port}.`);
      this.loggerAdapter.warn(`Server is already running on port ${port}.`);
      return this.serverInstance;
    }

    if (!this.isConfigured) {
      console.log('[WFServerSetup] Adapters not configured. Configuring with VS Code defaults.');
      this.loggerAdapter.info('Adapters not configured. Configuring with VS Code defaults.');
      this.configureAdapters();
    }

    console.log(`[WFServerSetup] Starting WFNodeServer on port ${port}...`);
    this.loggerAdapter.info(`Starting WFNodeServer on port ${port}...`);
    
    // Show the output channel so users can see the logs
    this.loggerAdapter.show();

    try {
      // createServer returns the http.Server instance directly after app.listen
      // It doesn't return a Promise in the provided library code.
      // We wrap it to make this method async and consistent.
      return new Promise((resolve, reject) => {
        // The library's createServer already logs "Server is running..."
        // It also doesn't handle listen errors in a way that createServer itself can reject.
        // The listen call itself can throw errors or emit an 'error' event.
        const server = createServer(port);

        server.on('listening', () => {
          this.serverInstance = server;
          console.log(`[WFServerSetup] WFNodeServer successfully started and listening on port ${port}.`);
          this.loggerAdapter.info(`WFNodeServer successfully started and listening on port ${port}.`);
          this.loggerAdapter.info('All WFNodeServer logs will now appear in this output channel.');
          resolve(server);
        });

        server.on('error', (error) => {
          console.error(`[WFServerSetup] Failed to start WFNodeServer on port ${port}:`, error);
          this.loggerAdapter.error(`Failed to start WFNodeServer on port ${port}:`, error);
          this.serverInstance = null; // Ensure it's null if start failed
          reject(error);
        });

        // Fallback if 'listening' or 'error' are not emitted quickly (e.g., port already in use error might be immediate)
        // However, the provided createServer already calls listen, so this is tricky.
        // The most robust way would be for `createServer` itself to return a Promise.
        // Given the current `createServer` implementation, we'll rely on the console log and assume success if no immediate error.
        // The 'listening' event handler above is the more correct way.

      });
    } catch (error) {
      console.error(`[WFServerSetup] Error during server creation call on port ${port}:`, error);
      this.loggerAdapter.error(`Error during server creation call on port ${port}:`, error);
      this.serverInstance = null;
      throw error; // Re-throw to be caught by the caller
    }
  }

  /**
   * Stops the currently running WFNodeServer.
   * @returns A Promise that resolves when the server is stopped.
   */
  public async stopServer(): Promise<void> {
    if (!this.serverInstance) {
      console.warn('[WFServerSetup] Server is not running or already stopped.');
      this.loggerAdapter.warn('Server is not running or already stopped.');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      console.log('[WFServerSetup] Stopping WFNodeServer...');
      this.loggerAdapter.info('Stopping WFNodeServer...');
      this.serverInstance?.close((err) => {
        if (err) {
          console.error('[WFServerSetup] Error stopping the server:', err);
          this.loggerAdapter.error('Error stopping the server:', err);
          reject(err);
        } else {
          console.log('[WFServerSetup] WFNodeServer stopped.');
          this.loggerAdapter.info('WFNodeServer stopped.');
          this.serverInstance = null;
          resolve();
        }
      });
    });
  }

  /**
   * Gets the current server instance.
   * @returns The HttpServer instance or null if not started.
   */
  public getServerInstance(): HttpServer | null {
    return this.serverInstance;
  }

  /**
   * Resets the configuration of the WFNodeServer library to its defaults
   * and stops the server if it's running.
   */
  public async reset(): Promise<void> {
    await this.stopServer();
    wfConfig.reset();
    this.isConfigured = false;
    console.log('[WFServerSetup] WFNodeServer configuration reset to defaults.');
    this.loggerAdapter.info('WFNodeServer configuration reset to defaults.');
  }

  /**
   * Gets the logger adapter instance
   * @returns The VscodeLoggerAdapter instance
   */
  public getLoggerAdapter(): VscodeLoggerAdapter {
    return this.loggerAdapter;
  }

  /**
   * Gets the WF Utilities logger adapter instance
   * @returns The VscodeWFLoggerAdapter instance
   */
  public getWFLoggerAdapter(): VscodeWFLoggerAdapter {
    return this.wfLoggerAdapter;
  }

  /**
   * Shows the WFNodeServer output channel
   */
  public showLogs(): void {
    this.loggerAdapter.show();
  }

  /**
   * Shows the WF Utilities output channel
   */
  public showWFUtilitiesLogs(): void {
    this.wfLoggerAdapter.show();
  }

  /**
   * Shows both output channels
   */
  public showAllLogs(): void {
    this.loggerAdapter.show();
    this.wfLoggerAdapter.show();
  }
}

// Example Usage (e.g., in your extension's activate function):
/*
import { WFServerSetup } from './WFServerSetup';

let serverSetup: WFServerSetup | null = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Your VS Code extension "my-wfnodeserver-extension" is now active!');

    serverSetup = new WFServerSetup();

    // Configure adapters (optional, startServer will do it if not called)
    // serverSetup.configureAdapters();

    try {
        const port = 3001; // Or get from config
        const server = await serverSetup.startServer(port);
        // Server is running
        vscode.window.showInformationMessage(`WFNodeServer started on port ${port}`);

        // Example: Command to open a file via the server (if server exposes such an API endpoint)
        // This would internally use the VscodeEditorAdapter
        context.subscriptions.push(
            vscode.commands.registerCommand('myExtension.openFileViaServer', async () => {
                // This is a hypothetical command. The actual interaction would depend
                // on how your WFNodeServer API is designed to trigger editor actions.
                // For example, an API call to the server might trigger editorAdapter.openFile().
                const filePath = await vscode.window.showInputBox({ prompt: "Enter file path to open" });
                if (filePath) {
                    // You might make an API call to your server, which then uses the configured editorAdapter
                    // For direct demonstration, we can call the adapter (though server should do it)
                    const editorAdapter = new VscodeEditorAdapter();
                    await editorAdapter.openFile(filePath);
                }
            })
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start WFNodeServer: ${error}`);
    }
}

export async function deactivate() {
    if (serverSetup) {
        await serverSetup.stopServer();
        await serverSetup.reset(); // Optional: reset library config
    }
}
*/


export const WFServer = new WFServerSetup();