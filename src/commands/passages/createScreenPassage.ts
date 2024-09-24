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

export const ${passageId}Passage = (): TPassage<'${selectedEvent}', '${selectedCharacter}'> => ({
    eventId: '${selectedEvent}',
    characterId: '${selectedCharacter}',
    id: '${passageId}',

    type: 'screen',
    title: '${title}',
    image: '',

    body: [
        {
            condition: true,
            text: '',
            links: [
                {
                    text: '',
                    passageId: '${selectedEvent}-${selectedCharacter}-',
                    cost: {
                        time: DeltaTime.fromMin(),
                        items: [{ id: '', count: 1 }],
                    },
                    autoPriortiy: 1,
                }
            ],
        },
    ],
});
    `;
};

