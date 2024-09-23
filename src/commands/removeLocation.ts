import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { locationFilePostfix, locationsDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { containerObjectName, locationDataImportString, locationImportingString } from './createLocation';

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
    removeFile(locationFilePath);



    
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