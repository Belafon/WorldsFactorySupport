import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
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

export type TEventFileData = {
    title: string,
    eventId: string,
    outline: string,
    description: string,
    timeRangeStart: string,
    timeRangeEnd: string,
    location: string,
};

export const createEvent = async (eventFileData: TEventFileData) => {
    if(!fs.existsSync(eventsDir())) {
        fs.mkdirSync(eventsDir());
    }
    
    const eventIdWithCapital = eventFileData.eventId.charAt(0).toUpperCase() + eventFileData.eventId.slice(1);
    const newEventContent =  `import { TEvent } from 'types/TEvent';
import { Time } from 'time/Time';
import { TEventPassage } from 'types/TPassage';

export const ${eventFileData.eventId}Event: TEvent<'${eventFileData.eventId}'> = {
\teventId: '${eventFileData.eventId}',
\ttitle: '${eventIdWithCapital} Event',
\tdescription: '${eventFileData.description}',
\ttimeRange: {
\t\tstart: Time.fromString('${eventFileData.timeRangeStart}'),
\t\tend: Time.fromString('${eventFileData.timeRangeEnd}'),
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

export const ${eventPassagesPropertyName(eventFileData.eventId)} = {
\t
} as const;

// test
Object.values(${eventPassagesPropertyName(eventFileData.eventId)}).forEach((item: () => TEventPassage<'${eventFileData.eventId}'>) => void item);
`;


    // add new folder in events
    try{
        fs.mkdirSync(path.join(eventsDir(), eventFileData.eventId));
    } catch (e){
        vscode.window.showErrorMessage("Directory cannot be created");
    }
    
    // Create the new event file
    const eventFilePath = path.join(eventsDir(), eventFileData.eventId, eventFileData.eventId + eventFilePostfix);
    fs.writeFile(eventFilePath, newEventContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new location file!');
        }
    });



    // Update the register.ts
    let registerFileData = await fs.promises.readFile(registerFilePath(), 'utf8');

    registerFileData = eventsImportingString(eventFileData.eventId) + registerFileData;
    let updatedData = await addObjectToOtherObject(containerObjectName, registerFileData, `${eventFileData.eventId}: ${eventFileData.eventId}${type}`, false);
    updatedData = await addObjectToOtherObject("passages", updatedData,  `...${eventPassagesPropertyName(eventFileData.eventId)}`, false);

    await fs.promises.writeFile(registerFilePath(), updatedData);




    

    // Update TWorldState.ts
    let worldStateFileData = await fs.promises.readFile((worldStateFilePath()), 'utf8');
    let updatedWorldStateFileData = await addObjectToOtherObject(
        containerObjectName,
        worldStateFileData,
        `${eventFileData.eventId}: { ref: T${type}<'${eventFileData.eventId}'> } & Partial<T${eventIdWithCapital}${type}Data>`,
        true);
    updatedWorldStateFileData = eventsDataImportString(eventFileData.eventId, eventIdWithCapital) + updatedWorldStateFileData;

    await fs.promises.writeFile(worldStateFilePath(), updatedWorldStateFileData);



    // Open the new character file
    const passageFileUri = vscode.Uri.file(eventFilePath);
    const passagerFile = await vscode.workspace.openTextDocument(passageFileUri);
    vscode.window.showTextDocument(passagerFile);
};


export const askPlayerForDataAndCreateEvent = async (context: vscode.ExtensionContext) => {

    let title = await askForId('Enter event id', 'Provide the id for the new event.'); 
    
    if (!title) {
        return;
    }

    let eventId = title.trim().toLowerCase().replace(/\s/g, '-');

    // now check if a location with the same name already exists
    if (doesIdExistsInFolder(locationsDir(), eventId)) {
        vscode.window.showErrorMessage(`An event with the id "${eventId}" already exists.`);
        const newId = await askForId('Enter event id', 'Provide the id for the new event.');
        
        if (!newId) {
            return;
        }

        eventId = newId;
    }

    const eventIdWithCapital = eventId.charAt(0).toUpperCase() + eventId.slice(1);

    const newEventContent = createEvent({
        title: '',
        eventId: eventId,
        outline: '',
        description: '',
        timeRangeStart: '',
        timeRangeEnd: '',
        location: '',
    });

};
