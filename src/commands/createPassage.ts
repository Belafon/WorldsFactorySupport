import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObjectWithEquals, askForId, doesIdExistsInFolder, extendPipelinedType, isIdValid } from '../WorkWithText';
import { passageFilePostfix, eventsDir, charactersDir, eventFilePostfix, eventFilePostfixWithoutFileType, eventPassagesFilePostfix } from '../Paths';
import { createScreenPassage } from './passages/createScreenPassage';
import { createLinearPassage } from './passages/createLinearPassage';
import { createTransitionPassage } from './passages/createTransitionPassage';
import { eventPassagesPropertyName } from './createEvent';

export const containerObjectName = 'passages';
export const type = 'Passage';

export enum PassageType {
    Screen = 'Screen',
    Transition = 'Transition',
    Linear = 'Linear',
};

export const getExportedPassageName = (passageId: string) => {
    return `${passageId}Passage`;
};

export function getPassageIdTypesPropertyName(selectedEvent: string, selectedCharacter: string) {
    const evnetIdWithCapital = selectedEvent.charAt(0).toUpperCase() + selectedEvent.slice(1);
    const characterIdWithCapital = selectedCharacter.charAt(0).toUpperCase() + selectedCharacter.slice(1);
    return `T${evnetIdWithCapital}${characterIdWithCapital}PassageId`;
}




export const createPassage = async (context: vscode.ExtensionContext) => {
    if (!fs.existsSync(eventsDir())) {
        fs.mkdirSync(eventsDir());
    }

    if (!fs.existsSync(charactersDir())) {
        fs.mkdirSync(charactersDir());
    }


    // Select an event

    // Get list of all events
    const eventNames = fs.readdirSync(eventsDir())
        .filter(file => fs.lstatSync(path.join(eventsDir(), file)).isDirectory());

    // Ask for the event id selection
    const selectedEvent = await vscode.window.showQuickPick(eventNames, {
        placeHolder: 'Select an event for the new passage',
    });

    if (!selectedEvent) {
        return;
    }

    const folderPathOfSelectedEvent = path.join(eventsDir(), selectedEvent);

    if (!fs.existsSync(folderPathOfSelectedEvent)) {
        return vscode.window.showErrorMessage('Event folder does not exist.');
    }

    // Check if the events file exists
    const eventFilePath = path.join(folderPathOfSelectedEvent, selectedEvent + eventPassagesFilePostfix);

    if (!fs.existsSync(eventFilePath)) {
        return vscode.window.showErrorMessage(`Event file ${eventFilePath} does not exist.`);
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
    const passageId = await askForId('Enter passage id', 'Provide the id for the new passage.');

    if (!passageId) {
        return;
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





    // Create passage file

    // Get file content

    let newPassageContent = '';
    switch (selectedPassageType) {
        case PassageType.Screen:
            newPassageContent = await createScreenPassage(context, selectedEvent, selectedCharacter, passageId);
            break;
        case PassageType.Linear:
            newPassageContent = await createLinearPassage(selectedEvent, selectedCharacter, passageId);
            break;
        case PassageType.Transition:
            newPassageContent = await createTransitionPassage(selectedEvent, selectedCharacter, passageId);
            break;
        default:
            return vscode.window.showErrorMessage('Invalid passage type.');
    }

    // if character folder does not exist, create it
    const passageFilePath = await createPassageWithArgs({
        folderPathOfSelectedCharacter,
        passageId,
        selectedPassageType,
        newPassageContent,
        eventFilePath,
        selectedEvent,
        selectedCharacter
    });

    if (!passageFilePath) {
        return;
    }



    // Open the new file
    const passageFileUri = vscode.Uri.file(passageFilePath);
    const passageFile = await vscode.workspace.openTextDocument(passageFileUri);
    vscode.window.showTextDocument(passageFile);
};


export type PassageArgs = {
    folderPathOfSelectedCharacter: string,
    passageId: string,
    selectedPassageType: PassageType,
    newPassageContent: string,
    eventFilePath: string,
    selectedEvent: string,
    selectedCharacter: string,
};


export async function createPassageWithArgs(args: PassageArgs) {
    if (!fs.existsSync(args.folderPathOfSelectedCharacter)) {
        await fs.mkdirSync(args.folderPathOfSelectedCharacter);
    }

    // Create the new passage file
    const passageFileNameWithoutPostfix = `${args.passageId}.${args.selectedPassageType.toLowerCase().replace(' ', '_')}`;
    const passageFileName = passageFileNameWithoutPostfix + passageFilePostfix;
    const passageFilePath = path.join(args.folderPathOfSelectedCharacter, passageFileName);
    fs.promises.writeFile(passageFilePath, args.newPassageContent);


    // Update event.passages file 

    let eventFileData = await fs.promises.readFile(args.eventFilePath, 'utf8');

    // Add import statement to the event file with the new passsage
    const importStatement = `import { ${getExportedPassageName(args.passageId)} } from './${args.selectedCharacter}.${containerObjectName}/${args.passageId}.${args.selectedPassageType.toLowerCase().replace(' ', '_')}';`;
    eventFileData = importStatement + '\n' + eventFileData;

    // Add the passage id to the event file, to the eventEventPassages object
    const fullPassageId = `${args.selectedEvent}-${args.selectedCharacter}-${args.passageId}`;
    // put this into the object 'kingdom-annie-intro': introPassage,
    const passageIdTypesPropertyName = getPassageIdTypesPropertyName(args.selectedEvent, ""); 
    let updateEventFileContent = await addObjectToOtherObjectWithEquals(
        eventPassagesPropertyName(args.selectedEvent) + `: Record<${passageIdTypesPropertyName}, (s: TWorldState, e: Engine) => TEventPassage<'${args.selectedEvent}'>>`, eventFileData, `'${fullPassageId}': ${getExportedPassageName(args.passageId)}`, false);
    
    const eventCharacterPassageIdProeprtyName = getPassageIdTypesPropertyName(args.selectedEvent, args.selectedCharacter);
    
    // Add TEventCharacterPassageId type to the end of the file
    // find TEventCharacterPassageId type according selected event and character if exists
    // if not exists, create a new one
    if(updateEventFileContent.includes(eventCharacterPassageIdProeprtyName)) {
        updateEventFileContent = await extendPipelinedType(updateEventFileContent, eventCharacterPassageIdProeprtyName, `'${fullPassageId}'`);
    } else {
        updateEventFileContent = await extendPipelinedType(updateEventFileContent, passageIdTypesPropertyName, eventCharacterPassageIdProeprtyName);
        updateEventFileContent += `\nexport type ${eventCharacterPassageIdProeprtyName} = '${fullPassageId}';\n`;
    }

    try {
        await fs.promises.writeFile(args.eventFilePath, updateEventFileContent);
    } catch (err) {
        return vscode.window.showErrorMessage('Failed to update event file!');
    }
    return passageFilePath;
}