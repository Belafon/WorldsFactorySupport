import * as vscode from 'vscode';


export const createLinearPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `import { TPassage } from 'types/TPassage';
    
const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'linear',
    description: '',
    nextPassageId: undefined,
}); `;
};