import * as vscode from 'vscode';
import { eventFilePostfixWithoutFileType } from '../../Paths';
import { getExportedPassageName, getPassageIdTypesPropertyName } from '../createPassage';


export const createLinearPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `// @ts-ignore
import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)} } from '../${selectedEvent}${eventFilePostfixWithoutFileType}';
// @ts-ignore
import { TWorldState } from 'data/TWorldState';
// @ts-ignore

const ${passageId}Passage = (s: TWorldState): TPassage<'${selectedEvent}', '${selectedCharacter}', ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)}> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    type: 'linear',
    description: '',
    nextPassageId: undefined,
}); 

export default ${passageId}Passage;
`;
};