import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, doesIdExistsInFolder } from '../WorkWithText';
import { eventsDir, eventFilePostfix, eventFilePostfixWithoutFileType, locationsDir, registerFilePath, worldStateFilePath } from '../Paths';

export const eventsDataImportString = (selectedEvent: string, selectedEventWithCapital: string): string => {
    return `import { T${selectedEventWithCapital}${type}Data } from './${containerObjectName}/${selectedEvent}/${selectedEvent}${eventFilePostfixWithoutFileType}';\n`;
};

export const eventsImportingString = (eventId: string): string => {
    return `import { ${eventId}${type}, ${eventPassagesPropertyName(eventId)} } from './${containerObjectName}/${eventId}/${eventId}${eventFilePostfixWithoutFileType}';\n`;
};

export const containerObjectName = 'events';
export const type = 'Event';

export const eventPassagesPropertyName = (eventId: string): string => {
    return `${eventId}EventPassages`;
}; 

export const createEvent = async (context: vscode.ExtensionContext) => {

    // Ask for the location name
    const eventId = await vscode.window.showInputBox({
        placeHolder: 'Enter event id',
        prompt: 'Provide the id for the new event.',
    });

    if (!eventId) {
        return vscode.window.showErrorMessage('You must provide an event id.');
    }


    // now check if a location with the same name already exists
    if (doesIdExistsInFolder(locationsDir(), eventId)) {
        vscode.window.showErrorMessage(`An event with the id "${eventId}" already exists.`);
        return vscode.window.showErrorMessage(`An event with the id "${eventId}" already exists.`);
    }

    const eventIdWithCapital = eventId.charAt(0).toUpperCase() + eventId.slice(1);

    const newEventContent = 
        `import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';

export const ${eventId}Event: TEvent<'${eventId}'> = {
\teventId: '${eventId}',
\ttitle: '${eventIdWithCapital} Event',
\tdescription: '',
\ttimeRange: {
\t\tstart: Time.fromS(),
\t\tend: Time.fromS(),
\t},
\tlocation: '',
\t
\tchildren: [],
\t
\ttriggers: [],
\t
\tinit: {},
};

export type T${eventIdWithCapital}EventData = {
\t
};

export const ${eventPassagesPropertyName(eventId)} = {
\t
} as const;

// test
Object.values(${eventPassagesPropertyName(eventId)}).forEach((item: () => TEventPassage<'${eventId}'>) => void item);
`;

    // add new folder in events
    fs.mkdirSync(path.join(eventsDir(), eventId));
    
    // Create the new event file
    const eventFilePath = path.join(eventsDir(), eventId, eventId + eventFilePostfix);
    fs.writeFile(eventFilePath, newEventContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new location file!');
        }
    });



    // Update the register.ts
    let registerFileData = await fs.promises.readFile(registerFilePath(), 'utf8');

    registerFileData = eventsImportingString(eventId) + registerFileData;
    let updatedData = await addObjectToOtherObject(containerObjectName, registerFileData, `${eventId}: ${eventId}${type}`);
    updatedData = await addObjectToOtherObject("passages", updatedData,  `...${eventPassagesPropertyName(eventId)}`);

    await fs.promises.writeFile(registerFilePath(), updatedData);




    

    // Update TWorldState.ts
    let worldStateFileData = await fs.promises.readFile((worldStateFilePath()), 'utf8');
    let updatedWorldStateFileData = await addObjectToOtherObject(
        containerObjectName,
        worldStateFileData,
        `${eventId}: { ref: T${type}<'${eventId}'> } & Partial<T${eventIdWithCapital}${type}Data>`);
    updatedWorldStateFileData = eventsDataImportString(eventId, eventIdWithCapital) + updatedWorldStateFileData;

    await fs.promises.writeFile(worldStateFilePath(), updatedWorldStateFileData);



    // Open the new character file
    const passageFileUri = vscode.Uri.file(eventFilePath);
    const passagerFile = await vscode.workspace.openTextDocument(passageFileUri);
    vscode.window.showTextDocument(passagerFile);
};
