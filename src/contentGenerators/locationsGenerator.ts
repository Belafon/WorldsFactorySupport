import * as vscode from "vscode";
import { createLocationWithArgs } from "../commands/createLocation";
import { generateContentTemplate } from "./generatorUserInputTemplate";

export const generateContentLocations = async (
  context: vscode.ExtensionContext
) => {
  try {
    const { numberOfElements, idPrefix } = await generateContentTemplate(
      "Locations"
    );
    for (let i = 0; i < numberOfElements; i++) {
      const locationId = `${idPrefix}_${i}_location`;
      const locationName = `Location ${i}`;
      await createLocationWithArgs(locationId, locationName);
    }
    vscode.window.showInformationMessage("Locations generated successfully.");
  } catch (error) {
    return;
  }
};
