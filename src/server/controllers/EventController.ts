import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import e, { Request, Response } from 'express';
import { eventsDir } from '../../Paths';
import { removeEventById } from '../../commands/removeEvent';
import { start } from 'repl';

export class EventController {

    public async updateEvent(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;
        const { title, description, location, timeRange } = req.body;

        try {
            // Construct path to event directory
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);

            // Check if event exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            // Read the current event file
            let eventContent = fs.readFileSync(eventFilePath, 'utf-8');

            // Update the event properties
            if (title) {
                eventContent = eventContent.replace(/title:\s*_\(['"](.*)['"]\)/, `title: _('${title}')`);
            }

            if (description) {
                // Handle both template literal and string literal cases
                if (eventContent.includes('description: `')) {
                    eventContent = eventContent.replace(/description:\s*`([^`]*)`/, `description: \`${description}\``);
                } else {
                    eventContent = eventContent.replace(/description:\s*['"](.*)['"]/, `description: '${description}'`);
                }
            }

            if (location) {
                eventContent = eventContent.replace(/location:\s*['"](.*)['"]/, `location: '${location}'`);
            }

            if (timeRange.start && timeRange.end) {
                eventContent = eventContent.replace(
                    /start:\s*Time\.fromString\(['"](.*)['"]/, 
                    `start: Time.fromString('${timeRange.start}'`
                );
                eventContent = eventContent.replace(
                    /end:\s*Time\.fromString\(['"](.*)['"]/, 
                    `end: Time.fromString('${timeRange.end}'`
                );
            }

            // Write the updated content back to the file
            fs.writeFileSync(eventFilePath, eventContent);

            res.json({
                success: true,
                message: `Event ${eventId} updated successfully`
            });
        } catch (error) {
            console.error('Error updating event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to update event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async setEventTime(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;
        const { timeRange } = req.body;

        try {
            // Construct path to event file
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);

            // Check if event exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            // Read the current event file
            let eventContent = fs.readFileSync(eventFilePath, 'utf-8');

            // Update the time range
            eventContent = eventContent.replace(
                /timeRange:\s*TimeRange\.fromString\(['"](.*)['"],\s*['"](.*)['"]/,
                `timeRange: TimeRange.fromString('${timeRange.start}', '${timeRange.end}'`
            );

            // Write the updated content back to the file
            fs.writeFileSync(eventFilePath, eventContent);

            res.json({
                success: true,
                message: `Event ${eventId} time range updated successfully`
            });
        } catch (error) {
            console.error('Error updating event time:', error);
            res.status(500).json({
                success: false,
                error: `Failed to update event time: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }


    public async openEvent(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;

        try {
            // Construct path to event file
            const eventDirPath = path.join(eventsDir(), eventId);
            const eventFilePath = path.join(eventDirPath, `${eventId}.event.ts`);

            // Check if event exists
            if (!fs.existsSync(eventFilePath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            // Open the file in VS Code
            const fileUri = vscode.Uri.file(eventFilePath);
            await vscode.window.showTextDocument(fileUri);

            res.json({
                success: true,
                message: `Opened event file: ${eventId}`
            });
        } catch (error) {
            console.error('Error opening event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to open event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    public async deleteEvent(req: Request, res: Response): Promise<void> {
        const eventId = req.params.eventId;

        try {
            // Check if event exists
            const eventDirPath = path.join(eventsDir(), eventId);
            if (!fs.existsSync(eventDirPath)) {
                res.status(404).json({
                    success: false,
                    error: `Event not found: ${eventId}`
                });
                return;
            }

            await removeEventById(eventId);

            res.json({
                success: true,
                message: `Event ${eventId} deleted successfully`
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            res.status(500).json({
                success: false,
                error: `Failed to delete event: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

}