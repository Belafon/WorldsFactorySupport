import * as vscode from 'vscode';
import { getExportedPassageName, getPassageIdTypesPropertyName } from '../createPassage';
import { eventFilePostfixWithoutFileType } from '../../Paths';


export const createTransitionPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `// @ts-ignore
import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)} } from '../${selectedEvent}${eventFilePostfixWithoutFileType}';

const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}', ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)}> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'transition',
    nextPassageId: '${selectedEvent}-${selectedCharacter}-',
});

export default ${passageId}Passage;
    `;
};