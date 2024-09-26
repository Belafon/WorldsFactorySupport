// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createLocation } from './commands/createLocation';
import { createCharacter } from './commands/createCharacter';
import { removeCharacter } from './commands/removeCharacter';
import { removeLocation } from './commands/removeLocation';
import { createSideCharacter } from './commands/createSideCharacter';
import { removeSideCharacter } from './commands/removeSideCharacter';
import { askPlayerForDataAndCreateEvent } from './commands/createEvent';
import { removeEvent } from './commands/removeEvent';
import { createPassage } from './commands/createPassage';
import { removePassage } from './commands/removePassage';
import { createEventWithOutline } from './commands/createEventOutline';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const createLocationCommand = vscode.commands.registerCommand('WorldsFactorySupport.createLocation', async () => {
        await createLocation(context);
    });
    context.subscriptions.push(createLocationCommand);

	const removeLocationCommand = vscode.commands.registerCommand('WorldsFactorySupport.removeLocation', async () => {
		await removeLocation(context);
	});
	context.subscriptions.push(removeLocationCommand);

	const createCharacterCommand = vscode.commands.registerCommand('WorldsFactorySupport.createCharacter', async () => {
		await createCharacter(context);
	});
	context.subscriptions.push(createCharacterCommand);

	const removeCharacterCommand = vscode.commands.registerCommand('WorldsFactorySupport.removeCharacter', async () => {
		await removeCharacter(context);
	});
	context.subscriptions.push(removeCharacterCommand);

	const createSideCharacterCommand = vscode.commands.registerCommand('WorldsFactorySupport.createSideCharacter', async () => {
		await createSideCharacter(context);
	});
	context.subscriptions.push(createSideCharacterCommand);

	const removeSideCharacterCommand = vscode.commands.registerCommand('WorldsFactorySupport.removeSideCharacter', async () => {
		await removeSideCharacter(context);
	});
	context.subscriptions.push(removeSideCharacterCommand);


	const createEventCommand = vscode.commands.registerCommand('WorldsFactorySupport.createEvent', async () => {
		await askPlayerForDataAndCreateEvent(context);
	});
	context.subscriptions.push(createEventCommand);
	
	const removeEventCommand = vscode.commands.registerCommand('WorldsFactorySupport.removeEvent', async () => {
		await removeEvent(context);
	});
	context.subscriptions.push(removeEventCommand);


	const createPassageCommand = vscode.commands.registerCommand('WorldsFactorySupport.createPassage', async () => {
		await createPassage(context);
	});

	context.subscriptions.push(createPassageCommand);

	const removePassageCommand = vscode.commands.registerCommand('WorldsFactorySupport.removePassage', async () => {
		await removePassage(context);
	});

	context.subscriptions.push(removePassageCommand);

	const createEventWithOutlineCommand = vscode.commands.registerCommand('WorldsFactorySupport.createEventWithOutline', async () => {
		await createEventWithOutline(context);
	});

	context.subscriptions.push(createEventWithOutlineCommand);
}
