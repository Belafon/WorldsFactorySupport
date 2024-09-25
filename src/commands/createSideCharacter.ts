import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
import { sideCharacterDir, registerFilePath, worldStateFilePath } from '../Paths';

export const characterDataImportString = (characterIdWithCapital: string, characterId: string) => {
    return `import { T${characterIdWithCapital}SideCharacterData } from './sideCharacters/${characterId}';\n`;
};

export const characterImportString = (characterIdWithCapital: string, characterId: string) => {
    return `import { ${characterIdWithCapital} } from './sideCharacters/${characterId}';\n`;
};

export const containerObjectName = 'sideCharacters';

export const createSideCharacter = async (context: vscode.ExtensionContext) => {

    // Ask for the character name
    const characterName = await vscode.window.showInputBox({
        placeHolder: 'Enter side character name (e.g., Thomas)',
        prompt: 'Provide the name for the new character.',
    });

    if (!characterName) {
        return vscode.window.showErrorMessage('You must provide a character name.');
    }

    let characterId = characterName;

    // Check if a character with the same name already exists
    if (doesIdExistsInFolder(sideCharacterDir(), characterName)) {
        vscode.window.showErrorMessage(`A character with the name "${characterName}" already exists.`);

        // Ask for the character ID
        const possibleNewCharacterId = await askForId('Enter side character ID (e.g., thomas)', 'Provide the ID for the new side character.');

        if (!possibleNewCharacterId) {
            return;
        }

        if (doesIdExistsInFolder(sideCharacterDir(), possibleNewCharacterId)) {
            return vscode.window.showErrorMessage(`A side character with the ID "${possibleNewCharacterId}" already exists.`);
        }

        characterId = possibleNewCharacterId;
    }
    
    const characterIdWithCapital = characterId.charAt(0).toUpperCase() + characterId.slice(1);
    const newCharacterContent = `
import { TSideCharacter } from 'types/TCharacter';

export const ${characterIdWithCapital}: TSideCharacter<'${characterId}'> = {
\tid: '${characterId}',
\tname: '${characterName}',
\tdescription: '',
\t
\tinit: {
\t\tinventory: [],
\t\tlocation: undefined,
\t},
};

export type T${characterIdWithCapital}SideCharacterData = {
\t
};
`;

    const characterFilePath = path.join(sideCharacterDir(), `${characterId}.ts`);

    // Create the new side character file
    fs.writeFile(characterFilePath, newCharacterContent, (err) => {
        if (err) {
            return vscode.window.showErrorMessage('Failed to create new character file!');
        }
    });

    // Update the register.ts

    let registerFileContent = fs.readFileSync(registerFilePath(), 'utf-8');
    registerFileContent = characterImportString(characterIdWithCapital, characterId) + registerFileContent;
    const updatedData = await addObjectToOtherObject(
        containerObjectName, registerFileContent, `${characterName}: ${characterIdWithCapital}`, false);

    fs.writeFileSync(registerFilePath(), updatedData);


    // Update TWorldState.ts
    let worldStateFileContent = fs.readFileSync(worldStateFilePath(), 'utf-8');
    worldStateFileContent = characterDataImportString(characterIdWithCapital, characterId) + worldStateFileContent;

    worldStateFileContent = await addObjectToOtherObject(
        containerObjectName, 
        worldStateFileContent, 
        `${characterId}: { ref: TSideCharacter<'${characterId}'> } & TSideCharacterData & Partial<T${characterIdWithCapital}SideCharacterData>`,
        true);

    fs.writeFileSync(worldStateFilePath(), worldStateFileContent);



    // Open the new side character file
    const characterFileUri = vscode.Uri.file(characterFilePath);
    const characterFile = await vscode.workspace.openTextDocument(characterFileUri);
    vscode.window.showTextDocument(characterFile);
};
