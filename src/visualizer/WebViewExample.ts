import * as vscode from 'vscode';
import * as http from 'http';

function createWebviewPanel(content: string, type: 'json' | 'html') {
    console.log('Creating webview panel with content:', content);
    const panel = vscode.window.createWebviewPanel(
        'visualizer',
        'Visualizer',
        vscode.ViewColumn.One,
        { enableScripts: true } // Enable scripts for interactivity
    );

    // Set HTML content of the webview
    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Visualizer</title>
        </head>
        <body>
            ${type === 'json' ? `<pre>${JSON.stringify(JSON.parse(content), null, 2)}</pre>` : content}
            <button id="sendData">Send Data</button>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('sendData').addEventListener('click', () => {
                    // Send a message to the extension
                    vscode.postMessage({ command: 'sendData', data: 'User clicked the button' });
                });
            </script>
        </body>
        </html>
    `;

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(message => {
        console.log('Received message from webview:', message);
        switch (message.command) {
            case 'sendData':
                vscode.window.showInformationMessage(`Data sent: ${message.data}`);
                // Send data to an external application/server here
                sendDataToExternalApplication(message.data);
                break;
        }
    });
}

// Example function for sending data to the external application
function sendDataToExternalApplication(data: string) {
    console.log('Sending data:', data);
    const http = require('http');

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/send-back',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    };

    const req = http.request(options, (res: http.IncomingMessage) => {
        res.on('data', d => {
            process.stdout.write(d);
        });
    });

    req.write(JSON.stringify({ data }));
    req.end();
}
