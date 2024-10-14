import * as vscode from 'vscode';
import { generateContentTemplate } from './generatorUserInputTemplate';
import { charactersDir, eventFilePostfix, eventPassagesFilePostfix, eventsDir } from '../Paths';
import * as fs from 'fs';
import { getScreenPassageContent } from '../commands/passages/createScreenPassage';
import { containerObjectName, createPassageWithArgs, PassageArgs, PassageType } from '../commands/createPassage';
import path from 'path';

export async function generateContentPassages(context: vscode.ExtensionContext) {
    try {
        const { numberOfElements, idPrefix } = await generateContentTemplate('Passages');

        
        
        for (let i = 0; i < numberOfElements; i++) {
            // choose random event
            const eventId = getRandomEvent();
            if (!eventId) {
                vscode.window.showErrorMessage('No events found!');
                return;
            }

            // choose random character
            const characterId = getRandomCharacter();
            if (!characterId) {
                vscode.window.showErrorMessage('No characters found!');
                return;
            }

            const folderPathOfSelectedEvent = path.join(eventsDir(), eventId);
            const folderPathOfSelectedCharacter = path.join(folderPathOfSelectedEvent, characterId + '.' + containerObjectName);
            const eventFilePath = path.join(folderPathOfSelectedEvent, eventId + eventPassagesFilePostfix);
            

            // choose random passage link
            let randomPassageId: string | undefined = '';

            // check if folder exists
            if (fs.existsSync(folderPathOfSelectedCharacter)) {
                const passagesFiles = fs.readdirSync(folderPathOfSelectedCharacter);
                if(passagesFiles.length !== 0) {
                    const randomIndex2 = Math.floor(Math.random() * passagesFiles.length);
                    const randomPassageFile = passagesFiles[randomIndex2];
                    randomPassageId = randomPassageFile.split('.')[0];
                }
            }


            const passageId = `${idPrefix}_${i}_passage`;
            const title = `Title of ScreenPassage ${i}`;
            
            let passageContent: string;
            if(randomPassageId === '') {
                randomPassageId = undefined;
            }
            
            passageContent = await getScreenPassageContent(eventId, characterId, passageId, title, randomPassageId);
            
            let passageArgs: PassageArgs;
            passageArgs = {
                folderPathOfSelectedCharacter: folderPathOfSelectedCharacter,
                passageId: passageId,
                selectedPassageType: PassageType.Screen,
                newPassageContent: passageContent,
                eventFilePath: eventFilePath,
                selectedEvent: eventId,
                selectedCharacter: characterId,
            };

            await createPassageWithArgs(passageArgs);
        }

        vscode.window.showInformationMessage('Passages generated successfully!');
    } catch (error) {
        vscode.window.showErrorMessage('Error generating passages: ' + error);
        return;
    }
}

function getRandomEvent() {
    const eventDir = eventsDir();
    const eventFolders = fs.readdirSync(eventDir);
    if(eventFolders.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * eventFolders.length);
    const randomEventFolder = eventFolders[randomIndex];
    const randomEventId = randomEventFolder;
    return randomEventId;
}


function getRandomCharacter() {
    const characterDir = charactersDir();
    const characterFiles = fs.readdirSync(characterDir);
    if(characterFiles.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * characterFiles.length);
    const randomCharacterFile = characterFiles[randomIndex];
    const randomCharacterId = randomCharacterFile.replace('.ts', '');
    return randomCharacterId;
}
