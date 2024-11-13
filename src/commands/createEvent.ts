import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  addObjectToOtherObject,
  askForId,
  askForTitle,
  doesIdExistsInFolder,
  getIdFromTitle,
  isIdValid,
} from "../WorkWithText";
import {
  eventsDir,
  eventFilePostfix,
  eventFilePostfixWithoutFileType,
  locationsDir,
  registerFilePath,
  worldStateFilePath,
  eventPassagesFilePostfix,
} from "../Paths";
import { getPassageIdTypesPropertyName } from "./createPassage";

// Generates the import string for event data when selected, returns it as a string
export const eventsDataImportString = (
  selectedEvent: string,
  selectedEventWithCapital: string
): string => {
  return `import { T${selectedEventWithCapital}${type}Data } from './${containerEventsObjectName}/${selectedEvent}/${selectedEvent}${eventFilePostfixWithoutFileType}';\n`;
};

// Constants for container name and type to maintain consistent naming conventions
export const containerEventsObjectName = "events";
export const containerPassagesObjectName = "passages";
export const type = "Event";

// Returns the property name for event passages based on eventId
export const eventPassagesPropertyName = (eventId: string): string => {
  return `${eventId}EventPassages`;
};

export function getImportEventPassagesFile(eventFileData: TEventFileData): string {
  return `${eventFileData.eventId}: () => import('./${containerEventsObjectName}/${eventFileData.eventId}/${eventFileData.eventId}.passages')`;
}

export function getImportEventFile(eventFileData: TEventFileData): string {
  return `${eventFileData.eventId}: () => import('./${containerEventsObjectName}/${eventFileData.eventId}/${eventFileData.eventId}${eventFilePostfixWithoutFileType}')`;
}

// Type definition for the event file data structure
export type TEventFileData = {
  title: string;
  eventId: string;
  description: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  location: string;
};

export const eventsImportingStringInRegister = (eventId: string) => {
  return `import { ${eventId}Event } from './${containerEventsObjectName}/${eventId}/${eventId}${eventFilePostfixWithoutFileType}';\n`;
};


// Function to create a new event
export const createEvent = async (
  eventFileData: TEventFileData
): Promise<string> => {
  // Ensure the events directory exists, if not, create it
  if (!fs.existsSync(eventsDir())) {
    fs.mkdirSync(eventsDir());
  }

  if (eventFileData.location === "") {
    eventFileData.location = "unknown";
  }

  if (eventFileData.timeRangeStart === "") {
    eventFileData.timeRangeStart = "0.0 0:0";
  }

  if (eventFileData.timeRangeEnd === "") {
    eventFileData.timeRangeEnd = "0.0 0:0";
  }

  // Capitalize event ID for usage in certain parts of the code
  const eventIdWithCapital =
    eventFileData.eventId.charAt(0).toUpperCase() +
    eventFileData.eventId.slice(1);
  const newEventContent = `import { Time, TimeRange } from 'time/Time';
import { TEvent } from 'types/TEvent';

export const ${eventFileData.eventId}Event: TEvent<'${eventFileData.eventId
    }'> = {
\teventId: '${eventFileData.eventId}',
\ttitle: _('${eventFileData.title}'),
\tdescription: \`${eventFileData.description}\`,
\ttimeRange: TimeRange.fromString('${eventFileData.timeRangeStart}', '${eventFileData.timeRangeEnd}'),
\tlocation: '${eventFileData.location}',
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
`;


  const newEventPassagesContent = `import { Engine } from 'code/Engine/ts/Engine';
import { TWorldState } from 'data/TWorldState';
import { TEventPassage } from 'types/TPassage';

export type ${getPassageIdTypesPropertyName(eventFileData.eventId, "")} = never;

const ${eventPassagesPropertyName(eventFileData.eventId)}: Record<${getPassageIdTypesPropertyName(eventFileData.eventId, "")}, (s: TWorldState, e: Engine) => TEventPassage<'${eventFileData.eventId}'>> = {
\t
};

export default ${eventPassagesPropertyName(eventFileData.eventId)};    
`;

  // Add a new folder for the event under the events directory
  try {
    fs.mkdirSync(path.join(eventsDir(), eventFileData.eventId));
  } catch (e) {
    vscode.window.showErrorMessage("Directory cannot be created");
  }

  // Create a new event file .event.ts
  const eventFilePath = path.join(
    eventsDir(),
    eventFileData.eventId,
    eventFileData.eventId + eventFilePostfix
  );
  fs.writeFile(eventFilePath, newEventContent, (err) => {
    if (err) {
      return vscode.window.showErrorMessage(
        "Failed to create new event file!"
      );
    }
  });


  // Create Passages.ts file

  const eventPassagesFilePath = path.join(
    eventsDir(),
    eventFileData.eventId,
    eventFileData.eventId + eventPassagesFilePostfix
  );

  fs.writeFile(eventPassagesFilePath, newEventPassagesContent, (err) => {
    if (err) {
      return vscode.window.showErrorMessage(
        "Failed to create new event passages file!"
      );
    }
  });



  // Update register.ts

  let registerFileData = await fs.promises.readFile(registerFilePath(), "utf8");
  registerFileData = eventsImportingStringInRegister(eventFileData.eventId) + registerFileData;

  // village: () => import('./events/village/village.event'),


  let updatedData = await addObjectToOtherObject(
    containerEventsObjectName,
    registerFileData,
    `${eventFileData.eventId}: ${eventFileData.eventId}${type}`,
    false
  );

  updatedData = await addObjectToOtherObject(
    containerPassagesObjectName,
    updatedData,
    getImportEventPassagesFile(eventFileData),
    false
  );

  await fs.promises.writeFile(registerFilePath(), updatedData);




  // Update TWorldState.ts

  let worldStateFileData = await fs.promises.readFile(
    worldStateFilePath(),
    "utf8"
  );
  let updatedWorldStateFileData = await addObjectToOtherObject(
    containerEventsObjectName,
    worldStateFileData,
    `${eventFileData.eventId}: { ref: T${type} <'${eventFileData.eventId}'> } & T${eventIdWithCapital}${type}Data`,
    true
  );
  updatedWorldStateFileData =
    eventsDataImportString(eventFileData.eventId, eventIdWithCapital) +
    updatedWorldStateFileData;

  await fs.promises.writeFile(worldStateFilePath(), updatedWorldStateFileData);

  return eventFilePath;
};


// Function to prompt the user for event data and create an event
export const askPlayerForDataAndCreateEvent = async (
  context: vscode.ExtensionContext
) => {
  // Ask the user for event ID, ensuring that input is trimmed, lowercased, and formatted correctly
  let title = await askForTitle(
    "Enter event title",
    "Provide the title for the new event."
  );

  if (!title) {
    return;
  }

  let eventId = await getIdFromTitle(title); 

  // Check if an event with the same ID already exists, prompt for a new one if necessary
  if (doesIdExistsInFolder(eventsDir(), eventId, true)) {
    vscode.window.showErrorMessage(
      `An event with the id "${eventId}" already exists.`
    );
    const newId = await askForId(
      "Enter event id",
      "Provide the id for the new event."
    );
    if (!newId) {
      return;
    }

    eventId = newId;
  }

  const eventFilePath = createEvent({
    title: title,
    eventId: eventId,
    description: "",
    timeRangeStart: "",
    timeRangeEnd: "",
    location: "",
  }).then(async (eventFilePath) => {
    // Open the new event file in the editor after creation
    const passageFileUri = vscode.Uri.file(eventFilePath);
    const passagerFile = await vscode.workspace.openTextDocument(
      passageFileUri
    );
    vscode.window.showTextDocument(passagerFile);
  });
};
