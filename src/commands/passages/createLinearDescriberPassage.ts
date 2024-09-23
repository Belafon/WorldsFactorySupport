

import * as vscode from 'vscode';


export const createLinearDescriberPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'linear',
    description: '',
    nextPassageId: undefined,
}); `;
};