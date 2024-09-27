import * as vscode from 'vscode';


export const createScreenPassage = async (context: vscode.ExtensionContext, 
    selectedEvent: string, selectedCharacter: string, passageId: string): Promise<string> => {
    
    // Ask for title of the passage
    const title = await vscode.window.showInputBox({
        placeHolder: 'Enter title',
        prompt: 'Provide the title for the new passage.',
    });


    return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

export const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => {   
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
                        passageId: '${selectedEvent}-${selectedCharacter}-',
                        cost: DeltaTime.fromMin(10),
                    }
                ],
            },
        ],
    };

}`;
};

