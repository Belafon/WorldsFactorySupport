import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { eventsDir } from '../../Paths';
import { PassageType, createPassageWithArgs, PassageArgs } from '../../commands/createPassage';
import { getScreenPassageContent } from '../../commands/passages/createScreenPassage';
import { createLinearPassage } from '../../commands/passages/createLinearPassage';
import { createTransitionPassage } from '../../commands/passages/createTransitionPassage';
import { removePassage, removePassageById } from '../../commands/removePassage';

export class PassageController {

    public async updatePassage(req: Request, res: Response): Promise<void> {
        const passageId = req.params.passageId;
        const { title, type } = req.body;

        const parts = validatePassageId(passageId, res);
        if (!parts) {
            return;
        }
        const [eventId, characterId, passagePartId] = parts;

        try {
            const characterPassagesFolder = path.join(
                eventsDir(),
                eventId,
                `${characterId}.passages`
            );

            // Find the passage file
            const files = fs.readdirSync(characterPassagesFolder);
            const passageFile = files.find(file =>
                file.startsWith(passagePartId)
            );

            if (!passageFile) {
                res.status(404).json({
                    success: false,
                    error: `Passage file not found for ID: ${passagePartId}`
                });
                return;
            }

            const passageFilePath = path.join(characterPassagesFolder, passageFile);

            // Read current content
            let content = fs.readFileSync(passageFilePath, 'utf-8');

            // Update properties
            if (type === "screen" || type === PassageType.Linear){
                if (title) {
                    content = content.replace(/title: _\(['"](.*)['"]\)/, `title: _('${title}')`);
                    content = content.replace(/title: ['"](.*)['"]/, `title: _('${title}')`);
                    
                }
            }

            // Write the updated content back to the file
            fs.writeFileSync(passageFilePath, content);

            res.    json({
                success: true,
                message: `Passage ${passageId} updated successfully`
            });
        } catch (error) {
            console.error('Error updating passage:', error);
            res.status(500).json({
                success: false,
                error: `Failed to update passage: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async deletePassage(req: Request, res: Response): Promise<void> {
        const passageId = req.params.passageId;

        const parts = validatePassageId(passageId, res);
        if (!parts) {
            return;
        }
        const [eventId, characterId, passagePartId] = parts;

        try {
            removePassageById(eventId, characterId, passagePartId);

            res.json({
                success: true,
                message: `Passage ${passageId} deleted successfully`
            });
        } catch (error) {
            console.error('Error deleting passage:', error);
            res.status(500).json({
                success: false,
                error: `Failed to delete passage: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async openPassage(req: Request, res: Response): Promise<void> {
        const passageId = req.params.passageId;

        const parts = validatePassageId(passageId, res);
        if (!parts) {
            return;
        }
        const [eventId, characterId, passagePartId] = parts;

        try {
            const characterPassagesFolder = path.join(
                eventsDir(),
                eventId,
                `${characterId}.passages`
            );

            if (!fs.existsSync(characterPassagesFolder)) {
                res.status(404).json({
                    success: false,
                    error: `Character passages folder not found: ${characterPassagesFolder}`
                });
                return;
            }

            // Find the passage file
            const files = fs.readdirSync(characterPassagesFolder);
            const passageFile = files.find(file =>
                file.startsWith(passagePartId)
            );

            if (!passageFile) {
                res.status(404).json({
                    success: false,
                    error: `Passage file not found for ID: ${passagePartId}`
                });
                return;
            }

            // Open the file in VS Code
            const fileUri = vscode.Uri.file(path.join(characterPassagesFolder, passageFile));
            await vscode.window.showTextDocument(fileUri);

            res.json({
                success: true,
                message: `Opened passage file: ${passageFile}`
            });
        } catch (error) {
            console.error('Error opening passage:', error);
            res.status(500).json({
                success: false,
                error: `Failed to open passage: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
}

function validatePassageId(passageId: string, res: Response<any, Record<string, any>>) : string[] | null {
    const parts = passageId.split('-');
    if (parts.length !== 3) {
        res.status(400).json({
            success: false,
            error: 'Invalid passage ID format. Expected format: eventId-characterId-passagePartId'
        });
        return null;
    }
    return parts;
}
