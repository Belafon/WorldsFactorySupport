import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFolder, removeLineByMatch, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { eventsDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { containerEventsObjectName, containerPassagesObjectName, eventsDataImportString, eventsImportingStringInRegister } from './createEvent';

export const removeEvent = async (context: vscode.ExtensionContext) => {
    if (!vscode.workspace.workspaceFolders) {
        return vscode.window.showErrorMessage('Please open a project folder first');
    }

    if (!fs.existsSync(eventsDir())) {
        return vscode.window.showErrorMessage('The events directory does not exist.');
    }

    // Get list of events
    const eventFolderNames = fs.readdirSync(eventsDir()).filter(file => fs.lstatSync(path.join(eventsDir(), file)).isDirectory());

    let selectedEvent: string | undefined;

    selectedEvent = await vscode.window.showQuickPick(eventFolderNames, {
        placeHolder: 'Select a event to remove',
    });


    if (!selectedEvent) {
        return vscode.window.showInformationMessage('No event selected for removal.');
    }

    // Check if the event has any passages, (just if the event folder has another folder named *.passages)
    const eventPath = path.join(eventsDir(), selectedEvent);
    if (fs.readdirSync(eventPath).some(file => file.endsWith('.passages'))) {
        const userResponse = await vscode.window.showWarningMessage(
            `The event "${selectedEvent}" has some passages, are you sure you want to remove it?`,
            'Yes', 'No'
        );

        if (userResponse === 'No') {
            return;
        }
    }

    await removeFolder(eventPath);
    


    // update the register.ts

    let registerFileData = await fs.readFileSync(registerFilePath(), 'utf-8');

    // Remove event from events object
    registerFileData = await removeObjectFromOtherObject(containerEventsObjectName, registerFileData, selectedEvent);
    registerFileData = await removeObjectFromOtherObject(containerPassagesObjectName, registerFileData, selectedEvent);

    fs.writeFileSync(registerFilePath(), registerFileData);

    // remove import satement
    registerFileData = await removeLineByMatch(registerFileData, eventsImportingStringInRegister(selectedEvent));




    // update the TWorldState.ts

    let worldStateFileData = fs.readFileSync(worldStateFilePath(), 'utf-8');
    let selectedEventWithCapital = selectedEvent.charAt(0).toUpperCase() + selectedEvent.slice(1);

    // Remove import statement
    worldStateFileData = await removeTextFromFile(
        worldStateFileData,
        eventsDataImportString(selectedEvent, selectedEventWithCapital));

    // Remove event from events object
    worldStateFileData = await removeObjectFromOtherObject(containerEventsObjectName, worldStateFileData, selectedEvent);

    fs.writeFileSync(worldStateFilePath(), worldStateFileData);

};
