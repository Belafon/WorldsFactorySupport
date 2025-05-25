import * as vscode from 'vscode';
import { EditorAdapter as WFEditorAdapterInterface } from 'wfnodeserver'; 
export class VscodeEditorAdapter implements WFEditorAdapterInterface {
  async openFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to open file "${filePath}": ${message}`);
      console.error(`[VscodeEditorAdapter] Error opening file: ${filePath}`, error);
      // Propagate the error if the interface expects it or if you need to handle it upstream
      // For now, we just log and show an error message.
      // Depending on wfnodeserver's expectation, you might need to throw error;
    }
  }

  showInformationNotification(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  showWarningNotification(message: string): void {
    vscode.window.showWarningMessage(message);
  }

  showErrorNotification(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}