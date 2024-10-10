import { TupleType } from "typescript";
import * as vscode from "vscode";
import * as fs from "fs";
import { createLocationWithArgs } from "../commands/createLocation";
import { generateContentTemplate } from "./generatorUserInputTemplate";
import { locationsDir } from "../Paths";
import { createEvent } from "../commands/createEvent";

export async function generateContentEvents(context: vscode.ExtensionContext) {
    try {
        const { numberOfElements, idPrefix } = await generateContentTemplate(
            "Events"
        );

        for (let i = 0; i < numberOfElements; i++) {
            const eventId = `${idPrefix}_${i}_event`;
            const eventName = `Event ${i}`;
            const description = `Description of event ${i}`;
            const location = getRandomLocation();
            const timeRangeStart = `2.1. 8:00`;
            const timeRangeEnd = `2.1. 20:00`;

            await createEvent({
                title: eventName,
                eventId,
                description,
                timeRangeStart,
                timeRangeEnd,
                location
            });
        }
        vscode.window.showInformationMessage("Events generated successfully.");
    } catch (error) {
        return;
    }
}
function getRandomLocation() {
    const lcotaionDir = locationsDir();
    const locationFiles = fs.readdirSync(lcotaionDir);
    const randomIndex = Math.floor(Math.random() * locationFiles.length);
    const locationFile = locationFiles[randomIndex];
    return locationFile.replace('.location.ts', '');
}

