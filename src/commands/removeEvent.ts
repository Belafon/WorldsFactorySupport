import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeFolder, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { eventFilePostfix, eventsDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { containerObjectName, eventsDataImportString, eventsImportingString } from './createEvent';

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
    if(fs.readdirSync(eventPath).some(file => file.endsWith('.passages'))){
        const userResponse = await vscode.window.showWarningMessage(
            `The event "${selectedEvent}" has some passages, are you sure you want to remove it?`,
            'Yes', 'No'
        );

        if(userResponse === 'No'){
            return;
        }
    }

    await removeFolder(eventPath);  


    // update the register.ts
    
    let registerFileData = await fs.readFileSync(registerFilePath(), 'utf-8');

    // Remove import statement
    let selectedEventWithCapital = selectedEvent.charAt(0).toUpperCase() + selectedEvent.slice(1);
    registerFileData = await removeTextFromFile(
        registerFileData, 
        eventsImportingString(selectedEvent));

    // Remove event from events object
    registerFileData = await removeObjectFromOtherObject(containerObjectName, registerFileData, selectedEvent);

    // remove ...eventIdEventPassages from passages object
    registerFileData = removeLineByMatch(registerFileData, `...${selectedEvent}EventPassages`);
    
    fs.writeFileSync(registerFilePath(), registerFileData);





    // update the TWorldState.ts

    let worldStateFileData = fs.readFileSync(worldStateFilePath(), 'utf-8');
    
    // Remove import statement
    worldStateFileData = await removeTextFromFile(
        worldStateFileData, 
        eventsDataImportString(selectedEvent, selectedEventWithCapital));

    // Remove event from events object
    worldStateFileData = await removeObjectFromOtherObject(containerObjectName, worldStateFileData, selectedEvent);

    fs.writeFileSync(worldStateFilePath(), worldStateFileData);

};

const removeLineByMatch = (data: string, match: string) => {
    return data.split('\n').filter(line => !line.includes(match)).join('\n');
};