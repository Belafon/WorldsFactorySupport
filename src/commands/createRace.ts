import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  addObjectToOtherObjectWithEquals,
  isIdValid,
} from "../WorkWithText";
import {
  racesDir,
  racesFilePath,
  registerFilePath,
} from "../Paths";

export const characterDataImportString = (
  characterIdWithCapital: string,
  characterId: string
) => {
  return `import { T${characterIdWithCapital}CharacterData } from './characters/${characterId}';\n`;
};

export const characterImportString = (
  characterIdWithCapital: string,
  characterId: string
) => {
  return `import { ${characterIdWithCapital} } from './characters/${characterId}';\n`;
};

export const containerObjectName = `races: Record<TRace['name'], TRace>`;

export const createRace = async (context: vscode.ExtensionContext) => {
  if (!fs.existsSync(racesDir())) {
    fs.mkdirSync(racesDir());
  }

  if (!fs.existsSync(racesFilePath())) {
    fs.writeFileSync(
      registerFilePath(),
      `import { TRace } from "types/TCharacter";
import { races } from './createRace';

export const races: Record<TRace['name'], TRace> = {
\thuman: {
\t\tname: _('Human'),
\t\tdescription: _(''),
\t},
};`
    );
  }

  //
  // Ask for the race name

  const raceName = await vscode.window.showInputBox({
    placeHolder: "Enter race name (e.g., Human)",
    prompt: "Provide the name for the new race.",
  });

  if (!raceName) {
    return;
  }

  const raceId = raceName.trim().toLowerCase().replace(/\s/g, "_");

  if (!isIdValid(raceId)) {
    return vscode.window.showErrorMessage(
      "Invalid id structure. It must contain only alphanumeric characters or underscores."
    );
  }

  //
  // Ask for description

  const description = await vscode.window.showInputBox({
    placeHolder: "Enter description",
    prompt: "Provide the description for the new Race.",
  });

  if (!description) {
    return;
  }

  //
  // Update races file

  const newRaceContent = `${raceId}: {
\tname: _('${raceName}'),
\tdescription: _('${description}'),
}`;

  let racesFileContent = fs.readFileSync(racesFilePath(), "utf-8");
  const updatedRaceData = await addObjectToOtherObjectWithEquals(
    containerObjectName,
    racesFileContent,
    newRaceContent,
    false
  );
  fs.writeFileSync(racesFilePath(), updatedRaceData);
};
