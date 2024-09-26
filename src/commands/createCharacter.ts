import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addObjectToOtherObject, askForId, doesIdExistsInFolder, isIdValid } from '../WorkWithText';
import { charactersDir, registerFilePath, worldStateFilePath } from '../Paths';

export const characterDataImportString = (characterIdWithCapital: string, characterId: string) => {
    return `import { T${characterIdWithCapital}CharacterData } from './characters/${characterId}';\n`;
};

export const characterImportString = (characterIdWithCapital: string, characterId: string) => {
    return `import { ${characterIdWithCapital} } from './characters/${characterId}';\n`;
};

export const containerObjectName = 'characters';

export const createCharacter = async (context: vscode.ExtensionContext) => {

    // Ask for the character name
    const characterName = await vscode.window.showInputBox({
        placeHolder: 'Enter character name (e.g., Thomas)',
        prompt: 'Provide the name for the new character.',
    });

    if (!characterName) {
        return vscode.window.showErrorMessage('You must provide a character name.');
    }

    let characterId = characterName.trim().toLowerCase().replace(/\s/g, '-');

    // Check if a character with the same name already exists
    if (doesIdExistsInFolder(charactersDir(), characterName)) {
        vscode.window.showErrorMessage(`A character with the name "${characterName}" already exists.`);

        const possibleNewCharacterId = await askForId('Enter character ID (e.g., thomas)', 'Provide the ID for the new character.');

        if (!possibleNewCharacterId) {
            return;
        }

        if (doesIdExistsInFolder(charactersDir(), possibleNewCharacterId)) {
            return vscode.window.showErrorMessage(`A character with the ID "${possibleNewCharacterId}" already exists.`);
        }

        characterId = possibleNewCharacterId;
    }
    
    const characterIdWithCapital = characterId.charAt(0).toUpperCase() + characterId.slice(1);
    const newCharacterContent = `
import { TCharacter } from 'types/TCharacter';

export const ${characterIdWithCapital}: TCharacter<'${characterId}'> = {
\tid: '${characterId}',
\tname: '${characterName}',
\tstartPassageId: undefined,
\t
\tinit: {
\t\thealth: 100,
\t\thunger: 100,
\t\tstamina: 100,
\t\tinventory: [],
\t\tlocation: undefined,
\t},
};

export type T${characterIdWithCapital}CharacterData = {
\t
};
`;

    const characterFilePath = path.join(charactersDir(), `${characterId}.ts`);

    // Create the new character file
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
        `${characterId}: { ref: TCharacter<'${characterId}'> } & TCharacterData & Partial<T${characterIdWithCapital}CharacterData>`,
        true);

    fs.writeFileSync(worldStateFilePath(), worldStateFileContent);



    // Open the new character file
    const characterFileUri = vscode.Uri.file(characterFilePath);
    const characterFile = await vscode.workspace.openTextDocument(characterFileUri);
    vscode.window.showTextDocument(characterFile);
};
