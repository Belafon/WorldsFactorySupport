import * as vscode from 'vscode';
import { WorkspaceAdapter as WFWorkspaceAdapterInterface } from 'wfnodeserver';

export class VscodeWorkspaceAdapter implements WFWorkspaceAdapterInterface {
    getWorkspaceFolderPath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const folder = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0] : undefined;
        return folder ? folder.uri.fsPath : '';
    }
    isWorkspaceValid(): boolean {
        return !!vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    }
}