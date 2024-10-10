import { link } from 'fs';
import * as vscode from 'vscode';


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
        return  `// @ts-ignore
import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

const passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => {   
    return {
        eventId: '${selectedEvent}',
        characterId: '${selectedCharacter}',
        id: '${passageId}',
    
        type: 'screen',
        title: _('${title}'),
        image: '',
    
        body: [
        ],
    };
}

export default passage;    
`;
    }

    return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

const passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => {   
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

export default passage;    
`;
}
