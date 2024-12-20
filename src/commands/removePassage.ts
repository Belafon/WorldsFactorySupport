import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeFolder, removeLineByMatch, removeTextFromFile } from '../WorkWithText';
import { eventFilePostfix, eventsDir } from '../Paths';


export const removePassage = async () => {
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
    const characterFiles = fs.readdirSync(charactersDir).filter(file => file.endsWith(passagesFolderPostfix));
    const characterNames = characterFiles.map(file => path.basename(file, passagesFolderPostfix));

    const selectedCharacter = await vscode.window.showQuickPick(characterNames, {
        placeHolder: 'Select a character',
    });

    if (!selectedCharacter) {
        return vscode.window.showInformationMessage('No character selected for removal.');
    }

    // get all passages that are related to the character and event
    const passagesDir = path.join(charactersDir, selectedCharacter + passagesFolderPostfix);
    const passageFiles = fs.readdirSync(passagesDir).filter(file => file.endsWith('.ts'));
    const passageNames = passageFiles.map(file => path.basename(file, '.ts'));

    const passageFileNameWithoutFileType = await vscode.window.showQuickPick(passageNames, {
        placeHolder: 'Select a passage to remove',
    });

    if (!passageFileNameWithoutFileType) {
        return vscode.window.showInformationMessage('No passage selected for removal.');
    }

    removePassageById(selectedEvent, selectedCharacter, passageFileNameWithoutFileType);
};

const passagesFolderPostfix = '.passages';
export const removePassageById = async (selectedEvent: string, selectedCharacter: string, passageFileNameWithoutFileType: string) => {
    const charactersDir = path.join(eventsDir(), selectedEvent);
    const passagesDir = path.join(charactersDir, selectedCharacter + passagesFolderPostfix);
    
    // Remove passage file
    const passageFilePath = path.join(passagesDir, `${passageFileNameWithoutFileType}.ts`);

    // Check if the character folder contains only one passage file
    if (fs.readdirSync(passagesDir).length === 1) {
        removeFolder(passagesDir);
    } else {
        removeFile(passageFilePath);
    }


    // Remove data from the event file

    const eventFilePath = path.join(eventsDir(), selectedEvent, selectedEvent + eventFilePostfix);

    if (!fs.existsSync(eventFilePath)) {
        return vscode.window.showErrorMessage(`Event file ${eventFilePath} does not exist.`);
    }

    let eventData = fs.readFileSync(eventFilePath, 'utf-8');
    const passageId = passageFileNameWithoutFileType.split('.')[0];

    // remove line from the event file
    const fullPassageId = `${selectedEvent}-${selectedCharacter}-${passageId}`;
    eventData = removeLineByMatch(eventData, fullPassageId);

    fs.writeFileSync(eventFilePath, eventData);
};
