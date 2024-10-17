import { link } from 'fs';
import * as vscode from 'vscode';
import { getPassageIdTypesPropertyName } from '../createPassage';
import { evnetPassagesFilePostfixWithoutFileType as eventPassagesFilePostfixWithoutFileType } from '../../Paths';


export const createScreenPassage = async (context: vscode.ExtensionContext,
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {

    // Ask for title of the passage
    let title = await vscode.window.showInputBox({
        placeHolder: 'Enter title',
        prompt: 'Provide the title for the new passage.',
    });

    if (!title) {
        title = "";
    }


    return getScreenPassageContent(selectedEvent, selectedCharacter, passageId, title, "");
};


export function getScreenPassageContent(
    selectedEvent: string, 
    selectedCharacter: string, 
    passageId: string, 
    title: string,
    linkPassageId: string | undefined)
    : string | PromiseLike<string> {

    if(linkPassageId === undefined) {
        return  `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)} } from '../${selectedEvent}${eventPassagesFilePostfixWithoutFileType}';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

export const ${passageId}Passage = (s: TWorldState, e: Engine): TPassage<'${selectedEvent}', '${selectedCharacter}', ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)}> => {   
    void s;
    void e;
    
    return {
        eventId: '${selectedEvent}',
        characterId: '${selectedCharacter}',
        id: '${passageId}',
    
        type: 'screen',
        title: _('${title}'),
        image: '',
    
        body: [
            {
                text: _(''),
                links: [

                ],
            },
        ],
    };
}
    
`;
    }

    return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)} } from '../${selectedEvent}${eventPassagesFilePostfixWithoutFileType}';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

export const ${passageId}Passage = (s: TWorldState, e: Engine): TPassage<'${selectedEvent}', '${selectedCharacter}', ${getPassageIdTypesPropertyName(selectedEvent, selectedCharacter)}> => {   
    void s;
    void e;

    return {
        eventId: '${selectedEvent}',
        characterId: '${selectedCharacter}',
        id: '${passageId}',
    
        type: 'screen',
        title: _('${title}'),
        image: '',
    
        body: [
            {
                text: _(''),
                links: [
                    {
                        text: _(''),
                        passageId: '${selectedEvent}-${selectedCharacter}-${linkPassageId}',
                        cost: DeltaTime.fromMin(10),
                    }
                ],
            },
        ],
    };
}
`;
}
