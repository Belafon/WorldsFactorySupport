import * as vscode from "vscode";
import { generateContentTemplate } from "./generatorUserInputTemplate";
import { createSideCharacterWithArgs } from "../commands/createSideCharacter";

export async function generateContentSideCharacters(context: vscode.ExtensionContext) {
    try{
        const { numberOfElements, idPrefix } = await generateContentTemplate("Side Characters");
        
        for (let i = 0; i < numberOfElements; i++) {
            const sideCharacterId = `${idPrefix}_${i}_sideCharacter`;
            const sideCharacterName = `Side Character ${i}`;
            await createSideCharacterWithArgs(sideCharacterId, sideCharacterName);
        }
        vscode.window.showInformationMessage("Side Characters generated successfully.");
    }
    catch (error) {
        return;
    }
}
