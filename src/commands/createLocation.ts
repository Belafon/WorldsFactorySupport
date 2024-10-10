import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
import { locationFilePostfix, locationFilePostfixWithoutFileType, locationsDir, registerFilePath, worldStateFilePath } from '../Paths';

export const locationDataImportString = (selectedLocation: string, selectedLocationWithCapital: string) => {
    return `import { T${selectedLocationWithCapital}LocationData } from './locations/${selectedLocation}${locationFilePostfixWithoutFileType}';\n`;
};

export const locationImportingString = (locationId: string) => {
    return `import { ${locationId}Location } from './locations/${locationId}${locationFilePostfixWithoutFileType}';\n`;
};

export const containerObjectName = 'locations';


export const createLocation = async (context: vscode.ExtensionContext) => {
    const userInput = await getUserInput();
    if (!userInput) {
        return;
    }

    const { locationName, locationId } = userInput;
    
    const locationFilePath = await createLocationWithArgs(locationId, locationName);

    // Open the new character file
    const locationFileUri = vscode.Uri.file(locationFilePath);
    const locationFile = await vscode.workspace.openTextDocument(locationFileUri);
    vscode.window.showTextDocument(locationFile);
};

const getUserInput = async (): Promise<{ locationName: string, locationId: string } | null> => {
    if (!fs.existsSync(locationsDir())) {
        fs.mkdirSync(locationsDir());
    }

    // Ask for the location name
    const locationName = await vscode.window.showInputBox({
        placeHolder: 'Enter location name (e.g., New Location)',
        prompt: 'Provide the name for the new location.',
    });

    if (!locationName) {
        return null;
    }

    let locationId = locationName.trim().toLowerCase().replace(/\s/g, '_');

    // now check if a location with the same name already exists
    if (doesIdExistsInFolder(locationsDir(), locationName)) {
        vscode.window.showErrorMessage(`A location with the name "${locationName}" already exists.`);

        const possibleNewLocationId = await askForId('Enter location ID', 'Provide the ID for the new location.');

        if (!possibleNewLocationId) {
            return null;
        }

        if (!isIdValid(possibleNewLocationId)) {
            vscode.window.showErrorMessage('Invalid location ID. It must be a valid TypeScript identifier.');
            return null;
        }

        if (doesIdExistsInFolder(locationsDir(), possibleNewLocationId)) {
            vscode.window.showErrorMessage(`A location with the ID "${locationId}" already exists.`);
            return null;
        }

        locationId = possibleNewLocationId;
    }

    return { locationName, locationId };
};

export async function createLocationWithArgs(locationId: string, locationName: string) {
    const locationIdWithCapital = locationId.charAt(0).toUpperCase() + locationId.slice(1);

    const newLocationContent = `import { TLocation } from 'types/TLocation';

export const ${locationId}Location: TLocation<'${locationId}'> = {
\tid: '${locationId}',
\tname: _('${locationName}'),
\tdescription: '',
\t
\tlocalCharacters: [
\t],

\tinit: {},
};

export type T${locationIdWithCapital}LocationData = {
\tvoid?: void;
};
`;

    const locationFilePath = path.join(locationsDir(), locationId + locationFilePostfix);

    // Create the new location file
    fs.writeFile(locationFilePath, newLocationContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new location file!');
        }
    });

    // Update the register.ts
    let registerFileData = await fs.promises.readFile(registerFilePath(), 'utf8');

    registerFileData = locationImportingString(locationId) + registerFileData;
    const updatedData = await addObjectToOtherObject(
        containerObjectName, registerFileData, `${locationId}: ${locationId}Location`, false);

    await fs.promises.writeFile(registerFilePath(), updatedData);

    // Update TWorldState.ts
    let worldStateFileData = await fs.promises.readFile((worldStateFilePath()), 'utf8');
    let updatedWorldStateFileData = await addObjectToOtherObject(
        containerObjectName,
        worldStateFileData,
        `${locationId}: { ref: TLocation<'${locationId}'> } & Partial<T${locationIdWithCapital}LocationData>`,
        true);
    updatedWorldStateFileData = locationDataImportString(locationId, locationIdWithCapital) + updatedWorldStateFileData;

    await fs.promises.writeFile(worldStateFilePath(), updatedWorldStateFileData);
    return locationFilePath;
}

