import * as vscode from 'vscode';


export const createTransitionPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'transition',
    nextPassageId: '${selectedEvent}-${selectedCharacter}-${passageId}',
});
    `;
};