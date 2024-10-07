import * as vscode from 'vscode';


export const createTransitionPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

const passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'transition',
    nextPassageId: '${selectedEvent}-${selectedCharacter}-',
});

export default passage;
    `;
};