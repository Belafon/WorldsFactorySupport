import * as vscode from "vscode";

export async function generateContentTemplate(worldType: string) {
    // ask for number of world elements
    const numberOfElements = await vscode.window
      .showInputBox({
        placeHolder: `Enter number of ${worldType}`,
        prompt: `Provide the number of ${worldType} to generate.`,
      })
      .then((value) => {
        return value ? parseInt(value) : 0;
      });
  
    if (!numberOfElements || numberOfElements < 1) {
      throw new Error("numberOfEvents cannot be less than 1");
    }
  
    // ask for id prefix
    const idPrefix = await vscode.window.showInputBox({
      placeHolder: `Enter ${worldType} id prefix`,
      prompt: `Provide the prefix for the ${worldType} ids.`,
    });
  
    if (!idPrefix || idPrefix.trim().length === 0) {
      throw new Error("idPrefix cannot be empty");
    }
  
    return { numberOfElements, idPrefix };
  }
  