import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, addToObjectArrayProperty, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
import { locationFilePostfix, locationFilePostfixWithoutFileType, locationsDir, registerFilePath, worldStateFilePath } from '../Paths';

export const locationDataImportString = (selectedLocation: string, selectedLocationWithCapital: string) => {
    return `import { T${selectedLocationWithCapital}LocationData } from './locations/${selectedLocation}${locationFilePostfixWithoutFileType}';\n`;
};

export const locationImportingString = (locationId: string) => {
    return `import { ${locationId}Location } from './locations/${locationId}${locationFilePostfixWithoutFileType}';\n`;
};


export const locationImportingStringInLocationFolder = (locationId: string) => {
    return `import { ${locationId}Location } from './${locationId}${locationFilePostfixWithoutFileType}';\n`;
}

export const containerObjectName = 'locations';

export const createLocation = async (context: vscode.ExtensionContext) => {
    const userInput = await getUserInput();
    if (!userInput) {
        return;
    }

    const { locationName, locationId, parentLocationId } = userInput;

    const locationFilePath = await createLocationWithArgs(locationId, locationName, parentLocationId);

    // Open the new location file
    const locationFileUri = vscode.Uri.file(locationFilePath);
    const locationFile = await vscode.workspace.openTextDocument(locationFileUri);
    vscode.window.showTextDocument(locationFile);
};

async function getAvailableLocations(): Promise<string[]> {
    try {
        const registerContent = await fs.promises.readFile(registerFilePath(), 'utf8');
        const locationMatch = registerContent.match(/locations:\s*{([^}]*)}/);
        if (!locationMatch) {
            return [];
        }

        const locationSection = locationMatch[1];
        // Extract location IDs from the locations section
        const locationIds = locationSection
            .split(',')
            .map(line => {
                const match = line.trim().match(/^(\w+):/);
                return match ? match[1] : null;
            })
            .filter((id): id is string => id !== null);

        return locationIds;
    } catch (error) {
        console.error('Error reading register file:', error);
        return [];
    }
}

async function selectParentLocation(availableLocations: string[]): Promise<string | undefined | Error> {
    // Build paths for all locations
    const locationPaths = await Promise.all(
        availableLocations.map(async (id) => ({
            id,
            path: await buildLocationPath(id)
        }))
    );

    // Sort by path to group related locations together
    locationPaths.sort((a, b) => a.path.localeCompare(b.path));

    const options = [
        'No parent location',
        ...locationPaths.map(loc => loc.path)
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select parent location (or none)',
        title: 'Parent Location Selection'
    });

    if (!selected) {
        return new Error('No parent location selected');
    }

    if (selected === 'No parent location') {
        return undefined;
    }



    // Find the location ID from the selected path
    const selectedLocation = locationPaths.find(loc => loc.path === selected);
    return selectedLocation?.id;
}


const getUserInput = async (): Promise<{
    locationName: string;
    locationId: string;
    parentLocationId?: string;
} | null> => {
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

    const availableLocations = await getAvailableLocations();
    const parentLocationId = await selectParentLocation(availableLocations);

    if (parentLocationId instanceof Error) {
        return null;
    }

    return { locationName, locationId, parentLocationId };
};


export async function createLocationWithArgs(locationId: string, locationName: string, parentLocationId?: string) {
    const locationIdWithCapital = locationId.charAt(0).toUpperCase() + locationId.slice(1);

    const newLocationContent = `import { TLocation } from 'types/TLocation';

export const ${locationId}Location: TLocation<'${locationId}'> = {
\tid: '${locationId}',
\tname: _('${locationName}'),
\tdescription: \`\`,
\t
\tlocalCharacters: [
\t],

\tinit: {},
};

export type T${locationIdWithCapital}LocationData = {
\t
};
`;

    const locationFilePath = path.join(locationsDir(), locationId + locationFilePostfix);


    // If there's a parent location, add this location as a sublocation
    if (parentLocationId) {

        // find the parent location file path
        let parentLocationFilePath = path.join(locationsDir(), parentLocationId + locationFilePostfix);
        if (!fs.existsSync(parentLocationFilePath)) {
            vscode.window.showErrorMessage(`Parent location file ${parentLocationFilePath} does not exist.`);
            return locationFilePath;
        }

        let parentLocationFileData = await fs.promises.readFile(parentLocationFilePath, 'utf8');

        let updatedParentLocationFildeData = await addToObjectArrayProperty(
            `${parentLocationId}Location`,
            'sublocations',
            `${locationId}Location`,
            parentLocationFileData
        );

        // add import to start of the file of the new sublocation
        updatedParentLocationFildeData = locationImportingStringInLocationFolder(locationId) + updatedParentLocationFildeData;

        await fs.promises.writeFile(parentLocationFilePath, updatedParentLocationFildeData);
    }


    // Create the new location file
    fs.writeFile(locationFilePath, newLocationContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new location file!');
        }
    });

    // Update the register.ts
    let registerFileData = await fs.promises.readFile(registerFilePath(), 'utf8');

    registerFileData = locationImportingString(locationId) + registerFileData;
    let updatedData = await addObjectToOtherObject(
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

async function getLocationData(locationId: string): Promise<{ name: string } | null> {
    try {
        const locationFilePath = path.join(locationsDir(), `${locationId}${locationFilePostfix}`);
        const content = await fs.promises.readFile(locationFilePath, 'utf8');

        // Extract name from the location file
        let nameMatch = content.match(/name:\s*_\('([^']+)'\)/);
        if (nameMatch) {
            return { name: nameMatch[1] };
        }
        nameMatch = content.match(/name:\s*'([^']+)'/);
        if (nameMatch) {
            return { name: nameMatch[1] };
        }
        nameMatch = content.match(/name:\s*"([^']+)"/);
        if (nameMatch) {
            return { name: nameMatch[1] };
        }
        return null;
    } catch (error) {
        console.error(`Error reading location file for ${locationId}:`, error);
        return null;
    }
}

async function buildLocationPath(locationId: string): Promise<string> {
    try {
        const registerContent = await fs.promises.readFile(registerFilePath(), 'utf8');
        const locationData = await getLocationData(locationId);
        if (!locationData) {
            return locationId;
        }

        const paths: string[] = [];
        let currentId = locationId;

        while (currentId) {
            // Look for this location as a sublocation in any other location
            const parentMatch = registerContent.match(
                new RegExp(`(\\w+)Location:\\s*{[^}]*sublocations:\\s*\\[([^\\]]*)${currentId}Location`)
            );

            if (!parentMatch) {
                break;
            }

            const parentId = parentMatch[1];
            paths.unshift(parentId);
            currentId = parentId;
        }

        paths.push(locationId);
        const pathStr = paths.join('/');
        return `${pathStr} ~ ${locationData.name}`;
    } catch (error) {
        console.error('Error building location path:', error);
        return locationId;
    }
}


