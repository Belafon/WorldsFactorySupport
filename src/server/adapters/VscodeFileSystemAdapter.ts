import * as vscode from 'vscode';
import { IFileSystem as WFFileSystemInterface } from 'wfnodeserver';
import { Buffer } from 'buffer'; // Node.js Buffer for string/byte conversions

/**
 * IMPORTANT CAVEAT:
 * The WFNodeServer's IFileSystem interface expects synchronous methods (e.g., readFileSync(): string).
 * However, VS Code's workspace.fs API is entirely asynchronous (e.g., readFile(): Promise<Uint8Array>).
 * This adapter implements the methods asynchronously.
 * For WFNodeServer to use this adapter correctly, its internal systems consuming IFileSystem
 * would need to be able to handle Promise-returning methods, or the IFileSystem interface
 * itself would need to be (or have an alternative) defined with async signatures.
 *
 * If WFNodeServer strictly relies on synchronous I/O from IFileSystem, this adapter
 * will lead to type errors or runtime errors when WFNodeServer tries to use it.
 */
export class VscodeFileSystemAdapter /* implements WFFileSystemInterface (with async adjustments) */ {
  // Note: The methods below return Promises. If WFFileSystemInterface has synchronous
  // return types (e.g., `string` instead of `Promise<string>`), this class
  // doesn't strictly implement it. This is due to VS Code's async FS API.

  public async existsSync(path: string): Promise<boolean> { // Original is sync: boolean
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path));
      return true;
    } catch {
      return false;
    }
  }

  public async readFileSync(path: string, encoding: string): Promise<string> { // Original is sync: string
    try {
      const uri = vscode.Uri.file(path);
      const fileContentUint8Array = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(fileContentUint8Array).toString(encoding as BufferEncoding);
    } catch (error) {
      console.error(`[VscodeFileSystemAdapter] Error reading file ${path}:`, error);
      throw error; // Re-throw to indicate failure
    }
  }

  public async writeFileSync(path: string, data: string, encoding: string): Promise<void> { // Original is sync: void
    try {
      const uri = vscode.Uri.file(path);
      const contentUint8Array = Buffer.from(data, encoding as BufferEncoding);
      await vscode.workspace.fs.writeFile(uri, contentUint8Array);
    } catch (error) {
      console.error(`[VscodeFileSystemAdapter] Error writing file ${path}:`, error);
      throw error;
    }
  }

  public async unlinkSync(path: string): Promise<void> { // Original is sync: void
    try {
      const uri = vscode.Uri.file(path);
      // For 'file', no options needed. For 'directory', { recursive: true } might be needed.
      await vscode.workspace.fs.delete(uri, { useTrash: false });
    } catch (error) {
      console.error(`[VscodeFileSystemAdapter] Error deleting file ${path}:`, error);
      throw error;
    }
  }

  public async readdirSync(path: string): Promise<string[]> { // Original is sync: string[]
    try {
      const uri = vscode.Uri.file(path);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      // entries are [fileName, FileType][], we need only fileNames (string[])
      return entries.map(entry => entry[0]);
    } catch (error) {
      console.error(`[VscodeFileSystemAdapter] Error reading directory ${path}:`, error);
      throw error;
    }
  }

  public async mkdirSync(path: string, options?: { recursive?: boolean }): Promise<void> { // Original is sync: void
    try {
      const uri = vscode.Uri.file(path);
      // vscode.workspace.fs.createDirectory is inherently recursive (like mkdir -p)
      // so the `options.recursive` flag is implicitly handled if true (the default behavior)
      // If `options.recursive` were `false`, this would be more complex to implement strictly.
      await vscode.workspace.fs.createDirectory(uri);
    } catch (error) {
      console.error(`[VscodeFileSystemAdapter] Error creating directory ${path}:`, error);
      throw error;
    }
  }
}