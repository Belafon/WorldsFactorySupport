import * as assert from 'assert';
import * as vscode from 'vscode';
import { addObjectToOtherObject, extendPipelinedType } from '../WorkWithText';

suite('formatContent Function Tests', () => {
});


suite('ExtendPipelinedType Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extend union type with new type', async () => {
        const input = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace';`;
        const expected = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace' |\n\t'kingdom-annie-dungeon';`;
        const result = await extendPipelinedType(input, 'TKingdomPassageId', 'kingdom-annie-dungeon');
        assert.strictEqual(result, expected);
    });

    test('Do not add duplicate type', async () => {
        const input = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace';`;
        const expected = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace';`;
        const result = await extendPipelinedType(input, 'TKingdomPassageId', 'kingdom-annie-palace');
        assert.strictEqual(result, expected);
    });

    test('Remove never from union type', async () => {
        const input = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace' | never;`;
        const expected = `export type TKingdomPassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace' |\n\t'kingdom-annie-dungeon';`;
        const result = await extendPipelinedType(input, 'TKingdomPassageId', 'kingdom-annie-dungeon');
        assert.strictEqual(result, expected);
    });

    test('Handle multiline union types', async () => {
        const input = `export type TKingdomPassageId = 
        'kingdom-annie-intro' |
        'kingdom-annie-palace' |
        never;
        `;
        const expected = `export type TKingdomPassageId = 
        'kingdom-annie-intro' |
        'kingdom-annie-palace' |\n\t'kingdom-annie-dungeon';
        `;
        const result = await extendPipelinedType(input, 'TKingdomPassageId', 'kingdom-annie-dungeon');
        assert.strictEqual(result, expected);
    });

    test('Add type to empty union definition', async () => {
        const input = `export type TKingdomPassageId = never;`;
        const expected = `export type TKingdomPassageId = 'kingdom-annie-dungeon';`;
        const result = await extendPipelinedType(input, 'TKingdomPassageId', 'kingdom-annie-dungeon');
        assert.strictEqual(result, expected);
    });
});
