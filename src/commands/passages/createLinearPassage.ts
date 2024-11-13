import * as vscode from 'vscode';
import { eventFilePostfixWithoutFileType } from '../../Paths';
import { getExportedPassageName, getPassageIdTypesPropertyName } from '../createPassage';


export const createLinearPassage = async ( 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)} } from '../${selectedEvent}${eventFilePostfixWithoutFileType}';
import { TWorldState } from 'data/TWorldState';

const ${passageId}Passage = (s: TWorldState): TPassage<'${selectedEvent}', '${selectedCharacter}', ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)}> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',
    title: _('${passageId}'),
    type: 'linear',
    description: \`\`,
    nextPassageId: undefined,
}); 

export default ${passageId}Passage;
`;
};