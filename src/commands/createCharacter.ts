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

// Function to create a character
export const createCharacter = async (context: vscode.ExtensionContext) => {
    const userInput = await getUserInput();
    if (!userInput) {
        return;
    }

    const { characterName, characterId } = userInput;

    const characterFilePath = await createCharacterWithArgs(characterId, characterName);

    // Open the new character file
    const characterFileUri = vscode.Uri.file(characterFilePath);
    const characterFile = await vscode.workspace.openTextDocument(characterFileUri);
    vscode.window.showTextDocument(characterFile);
};

// Function to get user input for character creation
const getUserInput = async (): Promise<{ characterName: string, characterId: string } | null> => {
    if (!fs.existsSync(charactersDir())) {
        fs.mkdirSync(charactersDir());
    }

    // Ask for the character name
    const characterName = await vscode.window.showInputBox({
        placeHolder: 'Enter character name (e.g., Thomas)',
        prompt: 'Provide the name for the new character.',
    });

    if (!characterName) {
        return null;
    }

    let characterId = characterName.trim().toLowerCase().replace(/\s/g, '_');

    // Check if a character with the same name already exists
    if (doesIdExistsInFolder(charactersDir(), characterName)) {
        vscode.window.showErrorMessage(`A character with the name "${characterName}" already exists.`);

        const possibleNewCharacterId = await askForId('Enter character ID (e.g., thomas)', 'Provide the ID for the new character.');

        if (!possibleNewCharacterId) {
            return null;
        }

        if (!isIdValid(possibleNewCharacterId)) {
            vscode.window.showErrorMessage('Invalid character ID. It must be a valid TypeScript identifier.');
            return null;
        }

        if (doesIdExistsInFolder(charactersDir(), possibleNewCharacterId)) {
            vscode.window.showErrorMessage(`A character with the ID "${possibleNewCharacterId}" already exists.`);
            return null;
        }

        characterId = possibleNewCharacterId;
    }

    return { characterName, characterId };
};

// Function to create character file, update register.ts and TWorldState.ts
export async function createCharacterWithArgs(characterId: string, characterName: string) {
    const characterIdWithCapital = characterId.charAt(0).toUpperCase() + characterId.slice(1);

    const newCharacterContent = `import { TCharacter } from 'types/TCharacter';

export const ${characterIdWithCapital}: TCharacter<'${characterId}'> = {
\tid: '${characterId}',
\tname: _('${characterName}'),
\tgeneral_description: \`\`,
\tstart_passage_Id: undefined,
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
    await fs.promises.writeFile(characterFilePath, newCharacterContent);

    // Update the register.ts
    let registerFileContent = await fs.promises.readFile(registerFilePath(), 'utf-8');
    registerFileContent = characterImportString(characterIdWithCapital, characterId) + registerFileContent;

    const updatedRegisterContent = await addObjectToOtherObject(
        containerObjectName, registerFileContent, `${characterId}: ${characterIdWithCapital}`, false
    );
    await fs.promises.writeFile(registerFilePath(), updatedRegisterContent);

    // Update TWorldState.ts
    let worldStateFileContent = await fs.promises.readFile(worldStateFilePath(), 'utf-8');
    worldStateFileContent = characterDataImportString(characterIdWithCapital, characterId) + worldStateFileContent;

    const updatedWorldStateContent = await addObjectToOtherObject(
        containerObjectName,
        worldStateFileContent,
        `${characterId}: { ref: TCharacter<'${characterId}'> } & TCharacterData & Partial<T${characterIdWithCapital}CharacterData>`,
        true
    );
    await fs.promises.writeFile(worldStateFilePath(), updatedWorldStateContent);

    return characterFilePath;
}
