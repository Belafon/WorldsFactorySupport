import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeFolder, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { eventFilePostfix, eventsDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { containerObjectName } from './createEvent';

export const removePassage = async (context: vscode.ExtensionContext) => {
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
        placeHolder: 'Select an event',
    });


    if (!selectedEvent) {
        return vscode.window.showInformationMessage('No event selected for removal.');
    }

    // get all characters that are related to the event
    const charactersDir = path.join(eventsDir(), selectedEvent);
    const characterFiles = fs.readdirSync(charactersDir).filter(file => file.endsWith('.passages'));
    const characterNames = characterFiles.map(file => path.basename(file, '.passages'));

    const selectedCharacter = await vscode.window.showQuickPick(characterNames, {
        placeHolder: 'Select a character',
    });

    if (!selectedCharacter) {
        return vscode.window.showInformationMessage('No character selected for removal.');
    }

    // get all passages that are related to the character and event
    const passagesDir = path.join(charactersDir, selectedCharacter + '.passages');
    const passageFiles = fs.readdirSync(passagesDir).filter(file => file.endsWith('.ts'));
    const passageNames = passageFiles.map(file => path.basename(file, '.ts'));

    const selectedPassage = await vscode.window.showQuickPick(passageNames, {
        placeHolder: 'Select a passage to remove',
    });

    if (!selectedPassage) {
        return vscode.window.showInformationMessage('No passage selected for removal.');
    }

    // Remove passage file
    const passageFilePath = path.join(passagesDir, `${selectedPassage}.ts`);
    
    // Check if the character folder contains only one passage file
    if(fs.readdirSync(passagesDir).length === 1){
        removeFolder(passagesDir);
    } else {
        removeFile(passageFilePath);
    }
};
