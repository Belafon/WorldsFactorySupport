// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createLocation } from "./commands/createLocation";
import { createCharacter } from "./commands/createCharacter";
import { removeCharacter } from "./commands/removeCharacter";
import { removeLocation } from "./commands/removeLocation";
import { createSideCharacter } from "./commands/createSideCharacter";
import { removeSideCharacter } from "./commands/removeSideCharacter";
import { askPlayerForDataAndCreateEvent } from "./commands/createEvent";
import { removeEvent } from "./commands/removeEvent";
import { createPassage } from "./commands/createPassage";
import { removePassage } from "./commands/removePassage";
import { createEventWithOutline } from "./commands/createEventOutline";
import { activateEditor, EventEditorProvider } from "./editors/EventEditor";
import { activatePassageEventNameCompletion } from "./completions/PassageEventNameCompletion";
import { createRace } from "./commands/createRace";
import { generateContentLocations } from "./contentGenerators/locationsGenerator";
import { generateContentCharacters } from "./contentGenerators/charactersGenerator";
import { generateContentEvents } from "./contentGenerators/eventsGenerator";
import { generateContentPassages } from "./contentGenerators/passagesGenerator";
import { generateContentSideCharacters } from "./contentGenerators/sideCharactersGenerator";
import { startNodeServerCommand, stopNodeServerCommand } from "./server/server";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  const createLocationCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createLocation",
    async () => {
      await createLocation(context);
    }
  );
  context.subscriptions.push(createLocationCommand);

  const removeLocationCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.removeLocation",
    async () => {
      await removeLocation(context);
    }
  );
  context.subscriptions.push(removeLocationCommand);

  const createCharacterCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createCharacter",
    async () => {
      await createCharacter(context);
    }
  );
  context.subscriptions.push(createCharacterCommand);

  const removeCharacterCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.removeCharacter",
    async () => {
      await removeCharacter(context);
    }
  );
  context.subscriptions.push(removeCharacterCommand);

  const createSideCharacterCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createSideCharacter",
    async () => {
      await createSideCharacter(context);
    }
  );
  context.subscriptions.push(createSideCharacterCommand);

  const removeSideCharacterCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.removeSideCharacter",
    async () => {
      await removeSideCharacter(context);
    }
  );
  context.subscriptions.push(removeSideCharacterCommand);

  const createEventCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createEvent",
    async () => {
      await askPlayerForDataAndCreateEvent(context);
    }
  );
  context.subscriptions.push(createEventCommand);

  const removeEventCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.removeEvent",
    async () => {
      await removeEvent();
    }
  );
  context.subscriptions.push(removeEventCommand);

  const createPassageCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createPassage",
    async () => {
      await createPassage(context);
    }
  );

  context.subscriptions.push(createPassageCommand);

  const removePassageCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.removePassage",
    async () => {
      await removePassage();
    }
  );

  context.subscriptions.push(removePassageCommand);

  const createEventWithOutlineCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createEventWithOutline",
    async () => {
      await createEventWithOutline(context);
    }
  );

  context.subscriptions.push(createEventWithOutlineCommand);

  const createRaceCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.createRace",
    async () => {
      await createRace(context);
    }
  );

  //
  // Content Generators
  //

  const generateLocationsCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.generateContentLocation",
    async () => {
      await generateContentLocations(context);
    }
  );

  context.subscriptions.push(generateLocationsCommand);

  const generateCharactersCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.generateContentCharacter",
    async () => {
      await generateContentCharacters(context);
    }
  );

  context.subscriptions.push(generateCharactersCommand);

  const generateEventsCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.generateContentEvent",
    async () => {
      await generateContentEvents(context);
    }
  );

  context.subscriptions.push(generateEventsCommand);

  const generatePassagesCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.generateContentPassage",
    async () => {
      await generateContentPassages(context);
    }
  );

  context.subscriptions.push(generatePassagesCommand);

  const generateSideCharactersCommand = vscode.commands.registerCommand(
    "WorldsFactorySupport.generateContentSideCharacter",
    async () => {
      await generateContentSideCharacters(context);
    }
  );

  activatePassageEventNameCompletion(context);

  const startNodeServerCommandD = vscode.commands.registerCommand(
    "WorldsFactorySupport.startNodeServer",
    async () => {
      startNodeServerCommand();
    }
  );

  const stopNodeServerCommandD = vscode.commands.registerCommand(
    "WorldsFactorySupport.stopNodeServer",
    async () => {
      stopNodeServerCommand();
    }
  );

  context.subscriptions.push(stopNodeServerCommandD);

  context.subscriptions.push(startNodeServerCommandD);

  //activateEditor(context);
}