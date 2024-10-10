import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  addObjectToOtherObject,
  askForId,
  doesIdExistsInFolder,
  isIdValid,
} from "../WorkWithText";
import {
  eventsDir,
  eventFilePostfix,
  eventFilePostfixWithoutFileType,
  locationsDir,
  registerFilePath,
  worldStateFilePath,
} from "../Paths";

// Generates the import string for event data when selected, returns it as a string
export const eventsDataImportString = (
  selectedEvent: string,
  selectedEventWithCapital: string
): string => {
  return `import { T${selectedEventWithCapital}${type}Data } from './${containerObjectName}/${selectedEvent}/${selectedEvent}${eventFilePostfixWithoutFileType}';\n`;
};

// Generates the import string for event objects and passages, returns it as a string
export const eventsImportingString = (eventId: string): string => {
  return `import { ${eventId}${type}, ${eventPassagesPropertyName(
    eventId
  )} } from './${containerObjectName}/${eventId}/${eventId}${eventFilePostfixWithoutFileType}';\n`;
};

// Constants for container name and type to maintain consistent naming conventions
export const containerObjectName = "events";
export const type = "Event";

// Returns the property name for event passages based on eventId
export const eventPassagesPropertyName = (eventId: string): string => {
  return `${eventId}EventPassages`;
};

// Type definition for the event file data structure
export type TEventFileData = {
  title: string;
  eventId: string;
  description: string;
  timeRangeStart: string;
  timeRangeEnd: string;
  location: string;
};




// Function to create a new event
export const createEvent = async (
  eventFileData: TEventFileData
): Promise<string> => {
  // Ensure the events directory exists, if not, create it
  if (!fs.existsSync(eventsDir())) {
    fs.mkdirSync(eventsDir());
  }

  // Capitalize event ID for usage in certain parts of the code
  const eventIdWithCapital =
    eventFileData.eventId.charAt(0).toUpperCase() +
    eventFileData.eventId.slice(1);
  const newEventContent = `// @ts-ignore
import { Time } from 'time/Time';
import { TEvent } from 'types/TEvent';
// @ts-ignore
import { TEventPassage } from 'types/TPassage';

export const ${eventFileData.eventId}Event: TEvent<'${eventFileData.eventId
    }'> = {
\teventId: '${eventFileData.eventId}',
\ttitle: _('${eventIdWithCapital} Event'),
\tdescription: '${eventFileData.description}',
\ttimeRange: {
\t\tstart: Time.fromString('${eventFileData.timeRangeStart}'),
\t\tend: Time.fromString('${eventFileData.timeRangeEnd}'),
\t},
\tlocation: '${eventFileData.location}',
\t
\tchildren: [],
\t
\ttriggers: [],
\t
\tinit: {},
};

export type T${eventIdWithCapital}EventData = {
\tvoid?: void;
};

export const ${eventPassagesPropertyName(eventFileData.eventId)} = {
\t
} as const;

// test
// Object.values(${eventPassagesPropertyName(eventFileData.eventId)}).forEach(
// \t(item: () => Promise<{ default: () => TEventPassage<'${eventFileData.eventId}'>}>) => void item
// );
`;

  // Add a new folder for the event under the events directory
  try {
    fs.mkdirSync(path.join(eventsDir(), eventFileData.eventId));
  } catch (e) {
    vscode.window.showErrorMessage("Directory cannot be created");
  }

  // Create a new event file
  const eventFilePath = path.join(
    eventsDir(),
    eventFileData.eventId,
    eventFileData.eventId + eventFilePostfix
  );
  fs.writeFile(eventFilePath, newEventContent, (err) => {
    if (err) {
      return vscode.window.showErrorMessage(
        "Failed to create new location file!"
      );
    }
  });

  // Read the register.ts file, prepend the import string and update it with the new event
  let registerFileData = await fs.promises.readFile(registerFilePath(), "utf8");
  registerFileData =
    eventsImportingString(eventFileData.eventId) + registerFileData;
  let updatedData = await addObjectToOtherObject(
    containerObjectName,
    registerFileData,
    `${eventFileData.eventId}: ${eventFileData.eventId}${type}`,
    false
  );
  updatedData = await addObjectToOtherObject(
    "passages",
    updatedData,
    `...${eventPassagesPropertyName(eventFileData.eventId)}`,
    false
  );

  await fs.promises.writeFile(registerFilePath(), updatedData);

  // Update TWorldState.ts file with event information
  let worldStateFileData = await fs.promises.readFile(
    worldStateFilePath(),
    "utf8"
  );
  let updatedWorldStateFileData = await addObjectToOtherObject(
    containerObjectName,
    worldStateFileData,
    `${eventFileData.eventId}: { ref: T${type}<'${eventFileData.eventId}'> } & Partial<T${eventIdWithCapital}${type}Data>`,
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
  let title = await askForId(
    "Enter event id",
    "Provide the id for the new event."
  );
  if (!title) {
    return;
  }

  let eventId = title.trim().toLowerCase().replace(/\s/g, "_");

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
    title: "",
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
