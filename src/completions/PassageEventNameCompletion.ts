import * as vscode from 'vscode';
import * as path from 'path';


export function activatePassageEventNameCompletion(context: vscode.ExtensionContext) {
    console.log('Activating passage event name completion');

    const provider = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', 
            language: 'typescript', 
            pattern: `**${path.sep}src${path.sep}data${path.sep}events${path.sep}**${path.sep}*.passages${path.sep}**${path.sep}*.ts` },
        {   
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                return getEventCompletions(document, position);
            }
        },
        ''
    );

    context.subscriptions.push(provider);
    console.log('Completion provider registered');
}


function getEventCompletions(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const completions: vscode.CompletionItem[] = [];
    const completionTitles: Set<string> = new Set();

    const documentPath = document.fileName;

    const regex = new RegExp(`.*\\${path.sep}events\\${path.sep}([^\\${path.sep}]+)\\${path.sep}([^\\${path.sep}]+)\\.passages\\${path.sep}[^\\${path.sep}]+\\.[^\\${path.sep}]+\\.ts$`);

    const match = documentPath.match(regex);

    if (match && match.length >= 3) {
        const eventId = match[1];
        const mainCharacterId = match[2];

        const stringToInsert = `s.characters.${mainCharacterId}.`;
        const completitionTitle = `${mainCharacterId}.`;
        completionTitles.add(completitionTitle);
        const completionItem = new vscode.CompletionItem(completitionTitle, vscode.CompletionItemKind.Snippet);
        completionItem.insertText = stringToInsert;
        completions.push(completionItem);
        
        const completitionTitle_main = `character`;
        completionTitles.add(completitionTitle_main);
        const completionItem_main = new vscode.CompletionItem(completitionTitle_main, vscode.CompletionItemKind.Snippet);
        completionItem_main.insertText = stringToInsert;
        completions.push(completionItem_main);

        // other characters
        // find all s.characters.{characterId} in the passage file and add them to completions
        const passageContent = document.getText();
        getCompletionsForType('characters', passageContent, completions, completionTitles);
        getCompletionsForType('locations', passageContent, completions, completionTitles, 'ref.');
        getCompletionsForType('sideCharacters', passageContent, completions, completionTitles); 
        getCompletionsForType('events', passageContent, completions, completionTitles);
    }

    return completions;
}

function getCompletionsForType(
    type: string, 
    passageContent: string, 
    completions: vscode.CompletionItem[], 
    completionTitles: Set<string>,
    modifier: string = '') {
    
    const regexString = `s\\.${type}\\.([a-zA-Z0-9-]+)\\.`;
    const regex = new RegExp(regexString, "g");

    const matches = passageContent.match(regex);
    const uniqueMatches = matches ? [...new Set(matches)] : [];
    console.log(uniqueMatches);
    if (matches) {
        uniqueMatches.forEach((match) => {
            const id = match.split('.')[2];
            const stringToInsert = `s.${type}.${id}.${modifier}`;
            const completitionTitle = `${id}.`;
            
            if(completionTitles.has(completitionTitle)) {
                return;
            }
            completionTitles.add(completitionTitle);
            
            const completionItem = new vscode.CompletionItem(completitionTitle, vscode.CompletionItemKind.Snippet);
            completionItem.insertText = stringToInsert;
            completions.push(completionItem);
        });
    }
}