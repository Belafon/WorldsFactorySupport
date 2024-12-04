import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { locationFilePostfix, locationsDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { containerObjectName, locationDataImportString, locationImportingString, locationImportingStringInLocationFolder } from './createLocation';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/TypeScriptCodeBuilder';

export const removeLocation = async (context: vscode.ExtensionContext) => {
    if (!vscode.workspace.workspaceFolders) {
        return vscode.window.showErrorMessage('Please open a project folder first');
    }
    
    if (!fs.existsSync(locationsDir())) {
        return vscode.window.showErrorMessage('The locations directory does not exist.');
    }

    // Get list of locations
    const locationFiles = fs.readdirSync(locationsDir()).filter(file => file.endsWith(locationFilePostfix));
    const locationNames = locationFiles.map(file => path.basename(file, locationFilePostfix));

    let selectedLocation: string | undefined;

    selectedLocation = await vscode.window.showQuickPick(locationNames, {
        placeHolder: 'Select a location to remove',
    });


    if (!selectedLocation) {
        return vscode.window.showInformationMessage('No location selected for removal.');
    }

    // Remove location file
    const locationFilePath = path.join(locationsDir(), selectedLocation + locationFilePostfix);
    await removeFile(locationFilePath);



    // Remove location from sublocations in all other locations
    await removeLocationFromSublocations(selectedLocation);



    
    // update the register.ts
    
    let registerFileData = await fs.readFileSync(registerFilePath(), 'utf-8');

    // Remove import statement
    let selectedLocationWithCapital = selectedLocation.charAt(0).toUpperCase() + selectedLocation.slice(1);
    registerFileData = await removeTextFromFile(
        registerFileData, 
        locationImportingString(selectedLocation));

    // Remove location from locations object
    registerFileData = await removeObjectFromOtherObject(containerObjectName, registerFileData, selectedLocation);

    fs.writeFileSync(registerFilePath(), registerFileData);




    // update the TWorldState.ts

    let worldStateFileData = fs.readFileSync(worldStateFilePath(), 'utf-8');
    
    // Remove import statement
    worldStateFileData = await removeTextFromFile(
        worldStateFileData, 
        locationDataImportString(selectedLocation, selectedLocationWithCapital));

    // Remove location from locations object
    worldStateFileData = await removeObjectFromOtherObject(containerObjectName, worldStateFileData, selectedLocation);

    fs.writeFileSync(worldStateFilePath(), worldStateFileData);

};



/**
 * Removes a location from sublocation arrays in all location files
 */
async function removeLocationFromSublocations(locationToRemove: string): Promise<void> {
    // Get list of all location files
    const locationFiles = fs.readdirSync(locationsDir())
        .filter(file => file.endsWith(locationFilePostfix));

    for (const locationFile of locationFiles) {
        const filePath = path.join(locationsDir(), locationFile);
        let fileContent = await fs.promises.readFile(filePath, 'utf8');
        
        let wasModified = false;
        const builder = new TypeScriptCodeBuilder();
        builder.parseText(fileContent);

        const locationId = path.basename(locationFile, locationFilePostfix);
        const locationObjectName = `${locationId}Location`;

        // Find the location object
        builder.findObject(locationObjectName, {
            onFound: async (objectBuilder) => {
                // Find the sublocations array
                objectBuilder.findArray('sublocations', {
                    onFound: async (arrayBuilder) => {
                        // Get all items to find the index of the location to remove
                        const items = arrayBuilder.getItems();
                        const locationToRemoveRef = `${locationToRemove}Location`;
                        
                        // Find and remove the item with the matching location reference
                        items.forEach((item: any, index: number) => {
                            if (String(item).includes(locationToRemoveRef)) {
                                arrayBuilder.removeItemAtIndex(index);
                                wasModified = true;
                            }
                        });
                    }
                });
            }
        });

        if (wasModified) {
            const updatedContent = await builder.toString();
            await fs.promises.writeFile(filePath, updatedContent);
        }
    }
}