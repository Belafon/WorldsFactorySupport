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

// Main function for creating a new side character
export const createSideCharacter = async (context: vscode.ExtensionContext) => {
    const userInput = await getUserInput();
    if (!userInput) {
        return;
    }

    const { characterName, characterId } = userInput;

    const characterFilePath = await createSideCharacterWithArgs(characterId, characterName);

    // Open the new character file
    const characterFileUri = vscode.Uri.file(characterFilePath);
    const characterFile = await vscode.workspace.openTextDocument(characterFileUri);
    vscode.window.showTextDocument(characterFile);
};

// Function to gather user input for creating the side character
const getUserInput = async (): Promise<{ characterName: string, characterId: string } | null> => {
    if (!fs.existsSync(sideCharacterDir())) {
        fs.mkdirSync(sideCharacterDir());
    }

    // Ask for the character name
    const characterName = await vscode.window.showInputBox({
        placeHolder: 'Enter side character name (e.g., Thomas)',
        prompt: 'Provide the name for the new side character.',
    });

    if (!characterName) {
        return null;
    }

    let characterId = characterName.trim().toLowerCase().replace(/\s/g, '_');

    // Check if a character with the same name already exists
    if (doesIdExistsInFolder(sideCharacterDir(), characterName)) {
        vscode.window.showErrorMessage(`A side character with the name "${characterName}" already exists.`);

        // Ask for the character ID
        const possibleNewCharacterId = await askForId('Enter side character ID (e.g., thomas)', 'Provide the ID for the new side character.');

        if (!possibleNewCharacterId) {
            return null;
        }

        if (doesIdExistsInFolder(sideCharacterDir(), possibleNewCharacterId)) {
            vscode.window.showErrorMessage(`A side character with the ID "${possibleNewCharacterId}" already exists.`);
            return null;
        }

        characterId = possibleNewCharacterId;
    }

    return { characterName, characterId };
};

// Function to create the side character file and update the necessary files
export async function createSideCharacterWithArgs(characterId: string, characterName: string) {
    const characterIdWithCapital = characterId.charAt(0).toUpperCase() + characterId.slice(1);

    const newCharacterContent = `import { TSideCharacter } from 'types/TCharacter';

export const ${characterIdWithCapital}: TSideCharacter<'${characterId}'> = {
\tid: '${characterId}',
\tname: _('${characterName}'),
\tgeneral_description: \`\`,
\t
\tinit: {
\t\tinventory: [],
\t\tlocation: undefined,
\t\tis_dead: false,
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
    let registerFileContent = await fs.promises.readFile(registerFilePath(), 'utf-8');
    registerFileContent = characterImportString(characterIdWithCapital, characterId) + registerFileContent;

    const updatedData = await addObjectToOtherObject(
        containerObjectName, registerFileContent, `${characterId}: ${characterIdWithCapital}`, false);

    await fs.promises.writeFile(registerFilePath(), updatedData);

    // Update TWorldState.ts
    let worldStateFileContent = await fs.promises.readFile(worldStateFilePath(), 'utf-8');
    worldStateFileContent = characterDataImportString(characterIdWithCapital, characterId) + worldStateFileContent;

    worldStateFileContent = await addObjectToOtherObject(
        containerObjectName,
        worldStateFileContent,
        `${characterId}: { ref: TSideCharacter<'${characterId}'> } & TSideCharacterData & Partial<T${characterIdWithCapital}SideCharacterData>`,
        true);

    await fs.promises.writeFile(worldStateFilePath(), worldStateFileContent);

    return characterFilePath;
}
