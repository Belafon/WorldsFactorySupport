import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, doesIdExistsInFolder } from '../WorkWithText';
import { passageFilePostfix, passageFilePostfixWithoutFileType, locationsDir, registerFilePath, worldStateFilePath, eventsDir, charactersDir } from '../Paths';
import { createScreenPassage } from './passages/createScreenPassage';
import { createLinearDescriberPassage } from './passages/createLinearDescriberPassage';
import { createTransitionPassage } from './passages/createTransitionPassage';

export const containerObjectName = 'passages';
export const type = 'Passage';

export enum PassageType {
    Screen = 'Screen',
    Transition = 'Transition',
    LinearDescriber = 'Linear Describer',
};


export const createPassage = async (context: vscode.ExtensionContext) => {


    // Select an event

    // Get list of all events
    const eventNames = fs.readdirSync(eventsDir())
            .filter(file => fs.lstatSync(path.join(eventsDir(), file)).isDirectory());
    
    // Ask for the event id selection
    const selectedEvent = await vscode.window.showQuickPick(eventNames, {
        placeHolder: 'Select an event for the new passage',
    });

    if (!selectedEvent) {
        return vscode.window.showErrorMessage('You must provide an event id.');
    }

    const folderPathOfSelectedEvent = path.join(eventsDir(), selectedEvent);

    if (!fs.existsSync(folderPathOfSelectedEvent)) {
        return vscode.window.showErrorMessage('Event folder does not exist.');
    }


    // Select a character

    // Get list of all possible characters


    const characterFiles = fs.readdirSync(charactersDir()).filter(file => file.endsWith('.ts'));
    const characterNames = characterFiles.map(file => path.basename(file, '.ts'));

    // Ask for the character id selection
    const selectedCharacter = await vscode.window.showQuickPick(characterNames, {
        placeHolder: 'Select a character for the new passage',
    });

    if (!selectedCharacter) {
        return vscode.window.showErrorMessage('You must provide a character id.');
    }

    const folderPathOfSelectedCharacter = path.join(folderPathOfSelectedEvent, selectedCharacter + '.' + containerObjectName);
    


    // Get passage id

    // Ask for the passage id
    const passageId = await vscode.window.showInputBox({
        placeHolder: 'Enter passage id',
        prompt: 'Provide the id for the new passage.',
    });

    if (!passageId) {
        return vscode.window.showErrorMessage('You must provide an passage id.');
    }

    // now check if a passage with the same name already exists
    if (doesIdExistsInFolder(folderPathOfSelectedCharacter, passageId)) {
        vscode.window.showErrorMessage(`An passage with the id "${passageId}" already exists.`);
        return vscode.window.showErrorMessage(`An passage with the id "${passageId}" already exists.`);
    }




    // Ask for passage type
    const selectedPassageType = await vscode.window.showQuickPick(Object.values(PassageType), {
        placeHolder: 'Select a type for the new passage',
    });

    const passageIdWithCapital = passageId.charAt(0).toUpperCase() + passageId.slice(1);




    // Create passage file

    // Get file content
    
    let newPassageContent = '';
    switch (selectedPassageType) {
        case PassageType.Screen:
            newPassageContent = await createScreenPassage(context, selectedEvent, selectedCharacter, passageId);
            break;
        case PassageType.LinearDescriber:
            newPassageContent = await createLinearDescriberPassage(context, selectedEvent, selectedCharacter, passageId);
            break;
        case PassageType.Transition:
            newPassageContent = await createTransitionPassage(context, selectedEvent, selectedCharacter, passageId);
            break;
        default:
            return vscode.window.showErrorMessage('Invalid passage type.');
    }

    // if character folder does not exist, create it
    if (!fs.existsSync(folderPathOfSelectedCharacter)) {
        fs.mkdirSync(folderPathOfSelectedCharacter);
    }
    
    // Create the new passage file
    const passageFilePath = path.join(folderPathOfSelectedCharacter, `${passageId}.${selectedPassageType.toLowerCase()}${passageFilePostfix}`);
    fs.writeFile(passageFilePath, newPassageContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new location file!');
        }
    });



    // Open the new new file
    const passageFileUri = vscode.Uri.file(passageFilePath);
    const passageFile = await vscode.workspace.openTextDocument(passageFileUri);
    vscode.window.showTextDocument(passageFile);
};
