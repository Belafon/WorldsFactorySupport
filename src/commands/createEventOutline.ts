import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
import { eventsDir, eventFilePostfix, eventFilePostfixWithoutFileType, locationsDir, registerFilePath, worldStateFilePath } from '../Paths';
import { createEvent } from './createEvent';

export const createEventWithOutline = async (context: vscode.ExtensionContext) => {
    const panel = vscode.window.createWebviewPanel(
        'createEvent', 
        'Create New Event',
        vscode.ViewColumn.One, 
        {
            enableScripts: true
        }
    );

    const locationOptions = loadLocationOptions();

    panel.webview.html = getWebviewContent(locationOptions);

    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'submitEvent':
                const { title, id, outline, description, timeRange, location } = message.data;

                if (!isIdValid(id)) {
                    vscode.window.showErrorMessage('Invalid ID!');
                    return;
                }

                if (await doesIdExistsInFolder(eventsDir(), id)) {
                    vscode.window.showErrorMessage('Event ID already exists!');
                    return;
                }

                await createEventFile({ title, id, outline, description, timeRange, location });
                vscode.window.showInformationMessage(`Event "${title}" created successfully.`);
                panel.dispose(); 
                break;
        }
    }, undefined, context.subscriptions);
};

function loadLocationOptions(): string[] {
    const locationsPath = path.join(locationsDir());
    if (fs.existsSync(locationsPath)) {
        const locationFiles = fs.readdirSync(locationsPath);
        return locationFiles.map(file => path.basename(file, path.extname(file)));
    } else {
        return ['undefined'];
    }
}

// Function to return HTML content for the form
function getWebviewContent(locationOptions: string[]): string {
    const locationOptionsHTML = locationOptions.map(option => `<option value="${option}">${option}</option>`).join('');
    const htmlPath = path.join(__dirname, '..', 'resources', 'EventOutline.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    htmlContent = htmlContent.replace('${locationOptions}', locationOptionsHTML);
    // replace all other ${...} placeholders as needed
    htmlContent = htmlContent.replace('${title}', '');
    htmlContent = htmlContent.replace('${id}', '');
    htmlContent = htmlContent.replace('${outline}', '');
    htmlContent = htmlContent.replace('${description}', '');
    htmlContent = htmlContent.replace('${timeRangeStart}', '');
    htmlContent = htmlContent.replace('${timeRangeEnd}', '');
    htmlContent = htmlContent.replace('${locationOptions}', '');
    
    return htmlContent;
}

async function createEventFile(eventData: { title: string, id: string, outline: string, description: string, timeRange: string, location: string }) {
    const eventFilePath = path.join(eventsDir(), `${eventData.id}${eventFilePostfix}`);
    
    createEvent({
        title: eventData.title,
        eventId: eventData.id,
        description: eventData.description,
        timeRangeStart: eventData.timeRange,
        timeRangeEnd: eventData.timeRange,
        location: eventData.location,
    });
}
