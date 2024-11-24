import * as vscode from 'vscode';
import * as fs from 'fs';
import { TypeScriptCodeBuilder } from './typescriptObjectParser/TypeScriptCodeBuilder';


export const addObjectToOtherObject = async (
    parentObjectName: string,
    data: string,
    contentToInsert: string,
    hasSemicolon: boolean): Promise<string> => {

    const regex = new RegExp(`(?<![a-zA-Z0-9_])${parentObjectName}:\\s*{((?:{[^{}]*}|[^{}])*)}`);

    const updatedData = data.replace(regex, (match, innerCode) => {
        return insertNewCodeIntoObjectsContent(innerCode, contentToInsert, match, parentObjectName, false, hasSemicolon);
    });

    return updatedData;
};

export const addObjectToOtherObjectWithEquals = async (
    parentObjectName: string,
    data: string,
    contentToInsert: string,
    hasSemicolon: boolean): Promise<string> => {
    const parentObjectNameEscaped = escapeRegExp(parentObjectName);
    const regex = new RegExp(`(?<![a-zA-Z0-9_])${parentObjectNameEscaped}\\s*=\\s*{((?:{[^{}]*}|[^{}])*)}`);
    const updatedData = data.replace(regex, (match, innerCode) => {
        return insertNewCodeIntoObjectsContent(innerCode, contentToInsert, match, parentObjectName, true, hasSemicolon);
    });

    return updatedData;
};

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insertNewCodeIntoObjectsContent(
    innerCode: string,
    contentToInsert: string,
    match: string,
    parentObjectName: string,
    hasEquals: boolean,
    hasSemicolon: boolean): string {

    const trimmedContent = innerCode.trim();


    // get space next to the last '}'
    // ',,,,     }' -> '     '
    let objectDepth: string = "";
    for (let i = match.length - 2; i >= 0; i--) {
        if (match[i] === '\t') {
            objectDepth += '\t';
        } else if (match[i] === ' ') {
            objectDepth += ' ';
        } else {
            break;
        }
    }

    // shift the content to insert by the object depth
    contentToInsert = contentToInsert.split('\n').map((line) => `${objectDepth}\t${line}`).join('\n');
    if (hasSemicolon) {
        contentToInsert += ';\n';
    } else {
        contentToInsert += ',\n';
    }


    // handle the empty object body as a special case
    if (trimmedContent === '') {
        if (hasEquals) {
            return `${parentObjectName} = {\n${contentToInsert}${objectDepth}}`;
        } else {
            return `${parentObjectName}: {\n${contentToInsert}${objectDepth}}`;
        }
    }


    // find out if the last character of the insert code is a comma
    innerCode = innerCode.trim();
    if (!hasSemicolon) {
        if (!innerCode.endsWith(',')) {
            innerCode = innerCode + ',';
        }
    }
    innerCode = objectDepth + '\t' + innerCode + '\n';

    const closingBracket = objectDepth + '}';

    // reconstruct the object with proper formatting
    if (hasEquals) {
        return `${parentObjectName} = {\n${innerCode}${contentToInsert}${closingBracket}`;
    }
    return `${parentObjectName}: {\n${innerCode}${contentToInsert}${closingBracket}`;
}




export async function removeObjectFromOtherObject(parentObjectName: string, data: string, objectNameToRemove: string): Promise<string> {
    const regex = new RegExp(`(?<![a-zA-Z0-9_])${parentObjectName}:\\s*{((?:{[^{}]*}|[^{}])*)}`);

    const updatedData = data.replace(regex, (match, innerCode) => {
        return removeObjectFromContent(innerCode, objectNameToRemove, match, parentObjectName);
    });

    return updatedData;
}

function removeObjectFromContent(innerCode: string, objectNameToRemove: string, match: string, parentObjectName: string): string {
    // find and remove object by regex
    const regex = new RegExp(`(?<![a-zA-Z0-9_])\\s*${objectNameToRemove}:\\s*{((?:{[^{}]*}|[^{}])*)}.*\\n`, 'g');

    let updatedMatch = match.replace(regex, '\n');


    // if nothing changed, we assume that the object is on one line without { }

    const regexOnLineObject = new RegExp(`(?<![a-zA-Z0-9_])\\s*${objectNameToRemove}:.*\\n`, 'g');

    updatedMatch = updatedMatch.replace(regexOnLineObject, '\n');

    return updatedMatch;
}



export async function removeTextFromFile(data: string, textToRemove: string): Promise<string> {
    return data.replace(textToRemove, '');
}


export async function removeFile(filePath: string) {
    const fs = vscode.workspace.fs;
    const uri = vscode.Uri.file(filePath);

    fs.delete(uri);

    // Close all open editors for the removed file
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                if (tab.input.uri.fsPath === filePath) {
                    await vscode.window.tabGroups.close(tab);
                }
            }
        }
    }

    await vscode.commands.executeCommand('typescript.restartTsServer');
}


export async function removeFolder(folderPath: string) {
    // Go through all files in the folder and close them in the editor if they are open
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                const fileFsPath = tab.input.uri.fsPath;
                if (fileFsPath.startsWith(folderPath)) {
                    await vscode.window.tabGroups.close(tab);
                }
            }
        }
    }

    vscode.workspace.fs.delete(vscode.Uri.file(folderPath), { recursive: true });
}




export const doesIdExistsInFolder = (folderPath: string, id: string, includeFolders = false): boolean => {
    if (!fs.existsSync(folderPath)) {
        return false;
    }

    const checkDirectory = (dirPath: string): boolean => {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = `${dirPath}/${file}`;
            if (!includeFolders && fs.statSync(fullPath).isDirectory()) {
                if (checkDirectory(fullPath)) {
                    return true;
                }
            } else {
                const currentFileName = file.split('.')[0].toLowerCase();
                if (currentFileName === id.toLowerCase()) {
                    return true;
                }
            }
        }
        return false;
    };

    return checkDirectory(folderPath);
};



export const removeLineByMatch = (data: string, match: string) => {
    return data.split('\n').filter(line => !line.includes(match)).join('\n');
};


/**
 * cannot start with a number, has to have at least one character
 * can contain '-' and '_'
 */
export const isIdValid = (id: string): boolean => {
    return /^[a-zA-Zá-žÁ-Ž][a-zA-Z0-9_á-žÁ-Ž]*$/.test(id);
};

export const askForId = async (placeHolder: string, prompt: string): Promise<string | undefined> => {
    let id: string | undefined = '';
    while (!isIdValid(id)) {
        id = await vscode.window.showInputBox({
            placeHolder,
            prompt,
        });
        
        if (id === undefined) {
            return undefined;
        }
        
        id = id.trim().toLocaleLowerCase().replace(/\s/g, '_');

        if (!isIdValid(id)) {
            vscode.window.showErrorMessage('Invalid id. Id cannot start with a number and has to contain at least one character.');
        }
    }
    return id;
};

export const askForTitle = async (placeHolder: string, prompt: string): Promise<string | undefined> => {
    let title: string | undefined = '';
    while (title === '') {
        title = await vscode.window.showInputBox({
            placeHolder,
            prompt,
        });
        
        if (title === undefined) {
            return undefined;
        }
        
        title = title.trim();
    }
    return title;
};

export const getIdFromTitle = (title: string): string => {
    return title.trim().toLowerCase().replace(/\s/g, '_');
};


export const extendPipelinedType = async (data: string, typeName: string, typeToInsert: string): Promise<string> => {
    // Match the type declaration with union types, even across newlines
    const regex = new RegExp(`(?<![a-zA-Z0-9_])${typeName}\\s*=\\s*([\\s\\S]*?);`, 'm');
    
    // Replace the matched part by adding the new type if it's not already present
    return data.replace(regex, (match, group1) => {
        let unionTypes = group1.trim();
        
        // Remove 'never' from the union if present
        unionTypes = unionTypes.replace(/\|\s*never(?![a-zA-Z0-9_])/g, '').replace(/(?<![a-zA-Z0-9_])never(?![a-zA-Z0-9_])/g, '');
        unionTypes = unionTypes.trim();

        // Check if the typeToInsert already exists in the union
        if (unionTypes.includes(typeToInsert)) {
            return match; // Return original if it's already there
        }

        // Add the new typeToInsert, separated by a pipe (|)
        let updatedUnion = `${unionTypes} |\n\t${typeToInsert}`;
        if(unionTypes === '') {
            updatedUnion = `${typeToInsert}`;
        }
        

        // Return the updated match with the new union types
        return match.replace(group1, updatedUnion);
    });
};

/**
 * Adds or updates an array property in an object
 */
export async function addToObjectArrayProperty(
    objectName: string,
    propertyName: string,
    itemToAdd: string,
    data: string
): Promise<string> {
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(data);

    builder.findObject(objectName, {
        onFound: (objectBuilder) => {
            objectBuilder.findArray(propertyName, {
                onFound: (arrayBuilder) => {
                    // If array exists, add new item to it using addItem
                    arrayBuilder.addItem(itemToAdd);
                },
                onNotFound: () => {
                    // If array doesn't exist, create it and add the item
                    objectBuilder.addArray(propertyName, (arrayBuilder) => {
                        arrayBuilder.addItem(itemToAdd);
                    });
                },
                onError: (error) => {
                    throw error;
                }
            });
        },
        onNotFound: () => {
            throw new Error(`Object ${objectName} not found`);
        },
        onError: (error) => {
            throw error;
        }
    });

    return builder.toString();
}

export async function removeFromObjectArrayProperty(
    objectName: string,
    propertyName: string,
    itemToRemove: string,
    data: string
): Promise<string> {
    const namePattern = `${objectName}`;
    const whitespace = `\\s*`;
    const typeAnnotation = `:${whitespace}TLocation<${whitespace}'[^']+'${whitespace}>${whitespace}`;
    const assignment = `=${whitespace}`;
    const openBrace = `{`;
    const content = `([^}]*)`;
    const closeBrace = `}`;
    
    const finalPattern = `${namePattern}${whitespace}${typeAnnotation}${assignment}${openBrace}${content}${closeBrace}`;
    const objectRegex = new RegExp(finalPattern, 's');
    
    return data.replace(objectRegex, (match) => {
        if (!match.includes(`${propertyName}:`)) {
            return match; // Property doesn't exist, return unchanged
        }

        return match.replace(
            new RegExp(`${propertyName}:\\s*\\[(.*?)\\]`, 's'),
            (arrayMatch, contents) => {
                const items: string[] = contents.split(',')
                    .map((item: string) => item.trim())
                    .filter((item: string) => item !== ''); // Filter out empty items
                const filteredItems = items
                    .filter((item: string) => item !== itemToRemove);
                return `${propertyName}: [${filteredItems.join(', ')}]`;
            }
        );
    });
}