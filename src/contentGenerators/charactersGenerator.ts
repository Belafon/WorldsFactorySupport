import * as vscode from "vscode";
import { generateContentTemplate } from "./generatorUserInputTemplate";
import { createCharacterWithArgs } from "../commands/createCharacter";

export async function generateContentCharacters(
  context: vscode.ExtensionContext
) {
  try {
    const { numberOfElements, idPrefix } = await generateContentTemplate(
      "Characters"
    );

    for (let i = 0; i < numberOfElements; i++) {
      const characterId = `${idPrefix}_${i}_character`;
      const characterName = `Character ${i}`;
      await createCharacterWithArgs(characterId, characterName);
    }
    vscode.window.showInformationMessage("Characters generated successfully.");
  } catch (error) {
    return;
  }
}