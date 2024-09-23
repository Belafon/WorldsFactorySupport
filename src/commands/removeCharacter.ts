import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeFile, removeObjectFromOtherObject, removeTextFromFile } from '../WorkWithText';
import { charactersDir, worldStateFilePath } from '../Paths';
import { registerFilePath } from '../Paths';
import { characterDataImportString, characterImportString, containerObjectName } from './createCharacter';

export const removeCharacter = async (context: vscode.ExtensionContext) => {
    if (!vscode.workspace.workspaceFolders) {
        return vscode.window.showErrorMessage('Please open a project folder first');
    }

    if (!fs.existsSync(charactersDir())) {
        return vscode.window.showErrorMessage('The characters directory does not exist.');
    }

    // Get list of characters
    const characterFiles = fs.readdirSync(charactersDir()).filter(file => file.endsWith('.ts'));
    const characterNames = characterFiles.map(file => path.basename(file, '.ts'));

    // Ask user to select a character to remove
    const selectedCharacter = await vscode.window.showQuickPick(characterNames, {
        placeHolder: 'Select a character to remove',
    });

    if (!selectedCharacter) {
        return vscode.window.showInformationMessage('No character selected for removal.');
    }




    // Remove character file
    const characterFilePath = path.join(charactersDir(), `${selectedCharacter}.ts`);
    removeFile(characterFilePath);

    
    
    
    
    
    // update the register.ts
    
    let registerFileData = await fs.readFileSync(registerFilePath(), 'utf-8');
    
    // Remove import statement
    const selectedCharacterWithCapital = selectedCharacter.charAt(0).toUpperCase() + selectedCharacter.slice(1);
    registerFileData = await removeTextFromFile(
        registerFileData, 
        characterImportString(selectedCharacterWithCapital, selectedCharacter));

    // Remove character from characters object
    registerFileData = await removeObjectFromOtherObject(containerObjectName, registerFileData, selectedCharacter);

    fs.writeFileSync(registerFilePath(), registerFileData);


    


    // update the TWorldState.ts

    let worldStateFileData = fs.readFileSync(worldStateFilePath(), 'utf-8');

    // Remove import statement
    worldStateFileData = await removeTextFromFile(
        worldStateFileData, 
        characterDataImportString(selectedCharacterWithCapital, selectedCharacter));

    // Remove object
    worldStateFileData = await removeObjectFromOtherObject(containerObjectName, worldStateFileData, selectedCharacter);

    fs.writeFileSync(worldStateFilePath(), worldStateFileData);
};