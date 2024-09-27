import * as vscode from 'vscode';
import * as path from 'path';
import { parseTypeScriptFile } from './tsObjectParser';
import { eventsDir, locationsDir } from '../Paths';

export function activateEditor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'eventEditor.eventEditor',
            new EventEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );
}

export class EventEditorProvider implements vscode.CustomTextEditorProvider {

    constructor(private readonly context: vscode.ExtensionContext) {
        vscode.window.showInformationMessage('Event Editor Activated!');
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const filePath = document.uri.fsPath;
        const parsedData = parseTypeScriptFile(filePath);

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getWebviewContent(parsedData, webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.command === 'updateEvent') {
                // Update document with new data
                const updatedContent = this.generateTypeScriptContent(e.data);
                this.updateDocument(document, updatedContent);
            }
        });
    }

    private getWebviewContent(data: any, webview: vscode.Webview): string {
        const locationOptions = this.getLocationOptions();
        // first objct in data
        const event = data[Object.keys(data)[0]];

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Edit Event</title>
                <style>
                    ${css}
                </style>
            </head>
            <body>
                <h1>Edit Event</h1>
                <form id="event-form">
                    <label for="eventId">Event ID:</label>
                    <input type="text" id="eventId" name="eventId" required value="${event.eventId || ''}">

                    <label for="title">Title:</label>
                    <input type="text" id="title" name="title" required value="${event.title || ''}">

                    <label for="outline">Outline:</label>
                    <textarea id="outline" name="outline" rows="3">${event.outline || ''}</textarea>

                    <label for="description">Description:</label>
                    <textarea id="description" name="description" rows="5">${event.description || ''}</textarea>

                    <label for="timeRangeStart">Start Time:</label>
                    <input type="datetime-local" id="timeRangeStart" name="timeRangeStart" required value="${event.timeRange?.start || ''}">
                    
                    <label for="timeRangeEnd">End Time:</label>
                    <input type="datetime-local" id="timeRangeEnd" name="timeRangeEnd" required value="${event.timeRange?.end || ''}">

                    <label for="location">Location:</label>
                    <select id="location" name="location">
                        ${locationOptions}
                    </select>
                </form>

                <script>
                    const vscode = acquireVsCodeApi();
                    const form = document.getElementById('event-form');

                    form.addEventListener('input', () => {
                        const formData = new FormData(form);
                        const data = Object.fromEntries(formData);
                        
                        vscode.postMessage({
                            command: 'updateEvent',
                            data: {
                                eventId: data.eventId,
                                title: data.title,
                                outline: data.outline,
                                description: data.description,
                                timeRange: {
                                    start: data.timeRangeStart,
                                    end: data.timeRangeEnd
                                },
                                location: data.location
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    private getLocationOptions(): string {
        // This should be replaced with actual location data
        const fs = require('fs');
        const locations = fs.readdirSync(locationsDir()).map((file: string) => path.basename(file, path.extname(file)).split('.')[0]);
        return locations.map((loc: string) => `<option value="${loc}">${loc}</option>`).join('');
    }

    private generateTypeScriptContent(data: any): string {
        return `
export const event: TEvent<TEventId> = {
    eventId: "${data.eventId}",
    title: "${data.title}",
    outline: "${data.outline}",
    description: "${data.description}",
    timeRange: {
        start: "${data.timeRange.start}",
        end: "${data.timeRange.end}"
    },
    location: "${data.location}",
    children: [],
    triggers: [],
    init: {}
};
        `.trim();
    }

    private updateDocument(document: vscode.TextDocument, content: string) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        vscode.workspace.applyEdit(edit);
    }

}
const css = `
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    background-color: #000000;
    color: #f4f4f4;
}
h1 {
    color: #3498db;
    text-align: center;
}
form {
    background-color: #464646;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}
input[type="text"],
textarea,
select {
    width: 100%;
    padding: 8px;
    margin-bottom: 15px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
}
textarea {
    resize: vertical;
}
button {
    background-color: #3498db;
    color: #fff;
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.3s;
}
button:hover {
    background-color: #2980b9;
}`;