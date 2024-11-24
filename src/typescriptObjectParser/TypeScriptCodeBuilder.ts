import * as tsNode from 'ts-node';
import * as prettier from 'prettier/standalone';
import * as standalone from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginTypescript from 'prettier/plugins/typescript';

import * as vscode from 'vscode';

const DEBUG = {
    ENABLED: true,
    log: (component: string, method: string, message: string, data?: any) => {
        if (DEBUG.ENABLED) {
            console.log(`[${component}:${method}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`);
        }
    }
};

interface BuilderOptions<T> {
    onFound: (value: T) => void;
    onNotFound?: (name: string) => void;
    onError?: (error: Error) => void;
}

// Make ArrayBuilderOptions independent of BuilderOptions
interface ArrayBuilderOptions {
    onFound?: (builder: ArrayBuilder) => void;
    onNotFound?: (name: string) => void;
    onError?: (error: Error) => void;
    itemType?: 'string' | 'number' | 'boolean' | 'object';
    validation?: (items: any[]) => boolean;
}

interface PropertyBuilderOptions<T> extends BuilderOptions<T> {
    propertyType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validation?: (value: T) => boolean;
}

export interface CodeBuilder {
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void;
    parseText(text: string): void;
    toString(): Promise<string>;
}

export interface ArrayBuilder {
    addNewObject(callback: (builder: ObjectBuilder) => void): void;
    addItem(value: string): void;
    getItems(): ObjectBuilder[];
}

export interface ObjectBuilder {
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void;
    findProperty(name: string, options: PropertyBuilderOptions<any>): void;
    findArray(name: string, options: ArrayBuilderOptions): void;
    setPropertyValue(name: string, value: string): void;
    addProperty(name: string, value: string): void;
    addArray(name: string, callback: (builder: ArrayBuilder) => void): void;
}
type BodyRange = {
    start: number;
    end: number;
}

export type CodeModification = {
    start: number;
    end: number;
    replacement: string;
};

export class TypeScriptCodeBuilder implements CodeBuilder {
    private sourceText: string = '';
    private modifications: CodeModification[] = [];

    constructor() {
        DEBUG.log('TypeScriptCodeBuilder', 'constructor', 'Initialized new builder');
    }

    parseText(text: string): void {
        DEBUG.log('TypeScriptCodeBuilder', 'parseText', 'Parsing new text', {
            textLength: text.length,
            textPreview: text.substring(0, 100)
        });
        this.sourceText = text;
        this.modifications = [];
    }

    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        DEBUG.log('TypeScriptCodeBuilder', 'findObject', `Starting search for object "${name}"`);

        try {
            const matches = this.scanForObjects(name);

            if (matches.length === 0) {
                DEBUG.log('TypeScriptCodeBuilder', 'findObject', `No matches found for "${name}"`);
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            const match = matches[0];
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', `Found match at index ${match.start}`, {
                matchText: this.sourceText.substring(match.start, match.end)
            });

            const bodyPosition = this.extractObjectBody(match.start);
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', 'Object body extracted', {
                body: this.sourceText.substring(bodyPosition.start, bodyPosition.end)
            });

            const builder = new TypeScriptObjectBuilder(
                this.sourceText,
                bodyPosition.start,
                bodyPosition.end,
                this.modifications
            );

            options.onFound(builder);

        } catch (error) {
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', 'Error processing object', { error });
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }

    private scanForObjects(name: string): { start: number; end: number }[] {
        DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects', `Starting scan for object "${name}"`);

        const matches: { start: number; end: number }[] = [];
        let currentPos = 0;
        let braceLevel = 0;
        let inString = false;
        let prevChar = '';

        const isIdentifierChar = (char: string) => /[a-zA-Z0-9_$]/.test(char);

        while (currentPos < this.sourceText.length) {
            const char = this.sourceText[currentPos];

            // Handle string literals
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
                DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
                    `String literal ${inString ? 'started' : 'ended'} at pos ${currentPos}`);
                currentPos++;
                prevChar = char;
                continue;
            }

            if (inString) {
                currentPos++;
                prevChar = char;
                continue;
            }

            // Track brace level
            if (char === '{') {
                braceLevel++;
                DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
                    `Brace level increased to ${braceLevel} at pos ${currentPos}`);
            } else if (char === '}') {
                braceLevel--;
                DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
                    `Brace level decreased to ${braceLevel} at pos ${currentPos}`);
            }

            // Only look for objects at the current level
            if (braceLevel === 0) {
                // Check if we're at the start of our target identifier
                if (isIdentifierChar(char)) {
                    const identifierStart = currentPos;
                    let identifierEnd = currentPos;

                    // Read the full identifier
                    while (identifierEnd < this.sourceText.length &&
                        isIdentifierChar(this.sourceText[identifierEnd])) {
                        identifierEnd++;
                    }

                    const foundIdentifier = this.sourceText.slice(identifierStart, identifierEnd);

                    if (foundIdentifier === name) {
                        DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
                            `Found potential identifier match at pos ${identifierStart}`, {
                            identifier: foundIdentifier
                        });

                        // Skip whitespace after identifier
                        let pos = identifierEnd;
                        while (pos < this.sourceText.length && /\s/.test(this.sourceText[pos])) {
                            pos++;
                        }

                        // Handle type annotation if present
                        if (this.sourceText[pos] === ':') {
                            pos++; // Skip the :
                            // Skip whitespace after :
                            while (pos < this.sourceText.length && /\s/.test(this.sourceText[pos])) {
                                pos++;
                            }

                            // Skip the type definition including generics
                            let genericLevel = 0;
                            while (pos < this.sourceText.length) {
                                if (this.sourceText[pos] === '<') {
                                    genericLevel++;
                                } else if (this.sourceText[pos] === '>') {
                                    genericLevel--;
                                } else if (this.sourceText[pos] === '=' && genericLevel === 0) {
                                    break;
                                }
                                pos++;
                            }
                        }

                        // Check for equals sign
                        while (pos < this.sourceText.length && /\s/.test(this.sourceText[pos])) {
                            pos++;
                        }

                        if (this.sourceText[pos] === '=') {
                            pos++; // Skip the =
                            // Skip whitespace after =
                            while (pos < this.sourceText.length && /\s/.test(this.sourceText[pos])) {
                                pos++;
                            }

                            if (this.sourceText[pos] === '{') {
                                DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
                                    `Valid object declaration found at pos ${identifierStart}`);
                                matches.push({
                                    start: identifierStart,
                                    end: pos
                                });
                            }
                        }
                    }
                }
            }

            currentPos++;
            prevChar = char;
        }

        DEBUG.log('TypeScriptCodeBuilder', 'scanForObjects',
            `Scan complete - found ${matches.length} matches`, { matches });
        return matches;
    }


    private extractObjectBody(startPos: number): BodyRange {
        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
            `Starting body extraction from pos ${startPos}`);

        // Move to opening brace
        let currentPos = startPos;
        while (currentPos < this.sourceText.length && this.sourceText[currentPos] !== '{') {
            currentPos++;
        }

        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
            `Found opening brace at pos ${currentPos}`);

        let braceCount = 0;
        let bodyStart = -1;
        let inString = false;
        let prevChar = '';

        while (currentPos < this.sourceText.length) {
            const char = this.sourceText[currentPos];

            // Handle string literals
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
            }

            if (!inString) {
                if (char === '{') {
                    braceCount++;
                    DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
                        `Opening brace found at pos ${currentPos}, count: ${braceCount}`);
                    if (braceCount === 1) {
                        bodyStart = currentPos + 1;
                        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
                            `Body starts at pos ${bodyStart}`);
                        currentPos++;
                        prevChar = char;
                        continue;
                    }
                } else if (char === '}') {
                    braceCount--;
                    DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
                        `Closing brace found at pos ${currentPos}, count: ${braceCount}`);
                    if (braceCount === 0) {
                        const body = this.sourceText.substring(bodyStart, currentPos);
                        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody',
                            'Body extraction complete', {
                            body,
                            start: bodyStart,
                            end: currentPos
                        });
                        return {
                            start: bodyStart,
                            end: currentPos
                        };
                    }
                }
            }

            currentPos++;
            prevChar = char;
        }

        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', 'Error: Missing closing brace');
        throw new Error('Invalid object structure: missing closing brace');
    }

    async toString(): Promise<string> {
        DEBUG.log('TypeScriptCodeBuilder', 'toString',
            `Converting to string with ${this.modifications.length} modifications`);

        const sortedMods = [...this.modifications].sort((a, b) => b.start - a.start);
        let result = this.sourceText;

        for (const mod of sortedMods) {
            DEBUG.log('TypeScriptCodeBuilder', 'toString', 'Applying modification', {
                start: mod.start,
                end: mod.end,
                replacement: mod.replacement
            });
            result = result.slice(0, mod.start) + mod.replacement + result.slice(mod.end);
        }

        // Format with prettier
        const formatted = await this.formatCode(result);

        // Ensure consistent newline at end
        return formatted.endsWith('\n') ? formatted : formatted + '\n';
    }


    private async formatCode(code: string): Promise<string> {
        DEBUG.log('TypeScriptCodeBuilder', 'formatCode', 'Formatting code with Prettier');
        try {
            const formattedCode = await standalone.format(code, {
                parser: 'typescript',
                plugins: [
                    prettierPluginBabel,
                    prettierPluginEstree,
                    prettierPluginTypescript
                ],
                semi: true,
                singleQuote: true,
                tabWidth: 4,
                printWidth: 80,
                trailingComma: 'es5',
                bracketSpacing: true,
                endOfLine: 'lf'
            });

            return formattedCode;
        } catch (error) {
            console.error('Error formatting code:', error);
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack
                });
            }
            return code; // Return original code if formatting fails
        }
    }

}


export class TypeScriptObjectBuilder implements ObjectBuilder {
    private sourceText: string;
    private startPos: number;
    private endPos: number;
    private modifications: CodeModification[];

    constructor(
        sourceText: string,
        startPos: number,
        endPos: number,
        modifications: CodeModification[]
    ) {
        this.sourceText = sourceText;
        this.startPos = startPos;
        this.endPos = endPos;
        this.modifications = modifications;
        DEBUG.log('TypeScriptObjectBuilder', 'constructor', 'Initialized new builder', {
            textLength: sourceText.length,
            startPos,
            endPos,
            textContent: sourceText.slice(startPos, endPos),
            currentModifications: modifications.length
        });
    }

    private findToken(
        name: string,
        expectedToken: string | null,
        options: BuilderOptions<any>
    ): { start: number; end: number; valueStart: number; valueEnd: number } | null {
        DEBUG.log('TypeScriptObjectBuilder', 'findToken', `Searching for token "${name}"`, {
            expectedToken,
            searchRange: { start: this.startPos, end: this.endPos },
            searchContent: this.sourceText.slice(this.startPos, this.endPos),
            modifications: this.modifications
        });

        // First try to find in original text
        const originalResult = this.findTokenInText(
            this.sourceText.slice(this.startPos, this.endPos),
            0,
            this.endPos - this.startPos,
            name,
            expectedToken
        );

        if (originalResult) {
            // Adjust positions for the actual text
            return {
                start: originalResult.start + this.startPos,
                end: originalResult.end + this.startPos,
                valueStart: originalResult.valueStart + this.startPos,
                valueEnd: originalResult.valueEnd + this.startPos
            };
        }

        // If not found in original text, check in the modified text
        let modifiedText = this.sourceText.slice(this.startPos, this.endPos);
        let offset = 0;

        for (const mod of this.modifications.sort((a, b) => a.start - b.start)) {
            // Only consider modifications within our range
            if (mod.start >= this.startPos && mod.start <= this.endPos) {
                // Apply the modification to our working text
                const relativeStart = mod.start - this.startPos;
                modifiedText = modifiedText.slice(0, relativeStart + offset) +
                    mod.replacement +
                    modifiedText.slice(relativeStart + offset + (mod.end - mod.start));
                offset += mod.replacement.length - (mod.end - mod.start);
            }
        }

        // Search in the combined text
        const modResult = this.findTokenInText(
            modifiedText,
            0,
            modifiedText.length,
            name,
            expectedToken
        );

        if (modResult) {
            // Adjust positions back to original text space
            return {
                start: modResult.start + this.startPos,
                end: modResult.end + this.startPos,
                valueStart: modResult.valueStart + this.startPos,
                valueEnd: modResult.valueEnd + this.startPos
            };
        }

        DEBUG.log('TypeScriptObjectBuilder', 'findToken', `Token "${name}" not found`);
        return null;
    }

    private findTokenInText(
        text: string,
        start: number,
        end: number,
        name: string,
        expectedToken: string | null
    ): { start: number; end: number; valueStart: number; valueEnd: number } | null {
        DEBUG.log('TypeScriptObjectBuilder', 'findTokenInText', 'Searching in text segment', {
            textSegment: text,
            start,
            end,
            name,
            expectedToken
        });

        let currentPos = start;
        let inString = false;
        let stringChar = '';
        let inComment = false;
        let commentType = '';
        let currentLevel = 1;

        while (currentPos < end) {
            const char = text[currentPos];
            const nextChar = currentPos + 1 < text.length ? text[currentPos + 1] : '';

            // Handle comments
            if (!inString && !inComment && char === '/' && nextChar === '/') {
                inComment = true;
                commentType = 'line';
                currentPos += 2;
                continue;
            }
            if (!inString && !inComment && char === '/' && nextChar === '*') {
                inComment = true;
                commentType = 'block';
                currentPos += 2;
                continue;
            }
            if (inComment) {
                if (commentType === 'line' && char === '\n') {
                    inComment = false;
                } else if (commentType === 'block' && char === '*' && nextChar === '/') {
                    inComment = false;
                    currentPos++;
                }
                currentPos++;
                continue;
            }

            // Handle strings
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
                currentPos++;
                continue;
            }
            if (inString && char === '\\' && nextChar === stringChar) {
                currentPos += 2;
                continue;
            }
            if (inString && char === stringChar) {
                inString = false;
                currentPos++;
                continue;
            }
            if (inString) {
                currentPos++;
                continue;
            }

            // Track nesting
            if (char === '{' || char === '[') {
                currentLevel++;
            } else if (char === '}' || char === ']') {
                currentLevel--;
                if (currentLevel < 1) break;
            }

            // Look for property names at the current level
            if (currentLevel === 1 && this.isIdentifierStart(char)) {
                const identStart = currentPos;
                let identEnd = currentPos;

                while (identEnd < end && this.isIdentifierChar(text[identEnd])) {
                    identEnd++;
                }

                const foundIdent = text.slice(identStart, identEnd);

                if (foundIdent === name) {
                    let pos = identEnd;
                    while (pos < end && /\s/.test(text[pos])) {
                        pos++;
                    }

                    if (text[pos] === ':') {
                        pos++;
                        while (pos < end && /\s/.test(text[pos])) {
                            pos++;
                        }

                        if (expectedToken === null || text[pos] === expectedToken) {
                            const valueStart = pos;
                            let valueEnd = pos;
                            let valueInString = false;
                            let valueStringChar = '';
                            let valueLevel = currentLevel;

                            while (valueEnd < end) {
                                const valueChar = text[valueEnd];
                                const nextValueChar = valueEnd + 1 < text.length ?
                                    text[valueEnd + 1] : '';

                                if (!valueInString && (valueChar === '"' || valueChar === "'")) {
                                    valueInString = true;
                                    valueStringChar = valueChar;
                                } else if (valueInString && valueChar === '\\' && nextValueChar === valueStringChar) {
                                    valueEnd += 2;
                                    continue;
                                } else if (valueInString && valueChar === valueStringChar) {
                                    valueInString = false;
                                } else if (!valueInString) {
                                    if (valueChar === '{' || valueChar === '[') {
                                        valueLevel++;
                                    } else if (valueChar === '}' || valueChar === ']') {
                                        valueLevel--;
                                        if (valueLevel < currentLevel) break;
                                    } else if (valueLevel === currentLevel && valueChar === ',') {
                                        break;
                                    }
                                }
                                valueEnd++;
                            }

                            DEBUG.log('TypeScriptObjectBuilder', 'findTokenInText', 'Found token', {
                                name,
                                value: text.slice(valueStart, valueEnd).trim()
                            });

                            return {
                                start: identStart,
                                end: valueEnd,
                                valueStart,
                                valueEnd
                            };
                        }
                    }
                }
            }

            currentPos++;
        }

        return null;
    }
    private isIdentifierStart(char: string): boolean {
        return /[a-zA-Z_$]/.test(char);
    }

    private isIdentifierChar(char: string): boolean {
        return /[a-zA-Z0-9_$]/.test(char);
    }

    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        DEBUG.log('TypeScriptObjectBuilder', 'findObject', `Searching for object "${name}"`);

        const result = this.findToken(name, '{', options);

        if (result) {
            DEBUG.log('TypeScriptObjectBuilder', 'findObject', `Found object "${name}"`, {
                range: { start: result.valueStart, end: result.valueEnd }
            });

            const builder = new TypeScriptObjectBuilder(
                this.sourceText,
                result.valueStart + 1,
                result.valueEnd - 1,
                this.modifications
            );
            options.onFound(builder);
        } else {
            DEBUG.log('TypeScriptObjectBuilder', 'findObject', `Object "${name}" not found`);
            if (options.onNotFound) {
                options.onNotFound(name);
            }
        }
    }

    findProperty(name: string, options: PropertyBuilderOptions<any>): void {
        DEBUG.log('TypeScriptObjectBuilder', 'findProperty', `Searching for property "${name}"`);

        const result = this.findToken(name, null, options);

        if (result) {
            let value;

            // Check if this is from a modification at the end
            const endModification = this.modifications.find(mod => mod.start === this.endPos);
            if (endModification && result.valueStart >= this.endPos) {
                // Extract value from the modification content
                const modifiedContent = this.sourceText.slice(this.startPos, this.endPos) +
                    endModification.replacement;
                const relativeStart = result.valueStart - this.startPos;
                const relativeEnd = result.valueEnd - this.startPos;
                value = modifiedContent.slice(relativeStart, relativeEnd).trim();

                DEBUG.log('TypeScriptObjectBuilder', 'findProperty', 'Found value in modification', {
                    value,
                    modifiedContent,
                    relativeStart,
                    relativeEnd
                });
            } else {
                // Check for direct modifications first
                const modification = this.modifications.find(mod =>
                    mod.start === result.valueStart && mod.end === result.valueEnd
                );

                value = modification ?
                    modification.replacement :
                    this.sourceText.slice(result.valueStart, result.valueEnd).trim();
            }

            DEBUG.log('TypeScriptObjectBuilder', 'findProperty', `Found property "${name}"`, {
                value,
                wasModified: true
            });
            options.onFound(value);
        } else {
            DEBUG.log('TypeScriptObjectBuilder', 'findProperty', `Property "${name}" not found`);
            if (options.onNotFound) {
                options.onNotFound(name);
            }
        }
    }

    findArray(name: string, options: ArrayBuilderOptions): void {
        DEBUG.log('TypeScriptObjectBuilder', 'findArray', `Searching for array "${name}"`);

        try {
            // Create a compatible options object for findToken
            const tokenOptions = {
                onFound: (value: any) => { },
                onNotFound: options.onNotFound,
                onError: options.onError
            };

            const result = this.findToken(name, '[', tokenOptions);

            if (result) {
                DEBUG.log('TypeScriptObjectBuilder', 'findArray', `Found array "${name}"`, {
                    range: { start: result.valueStart, end: result.valueEnd }
                });

                // Check if this is from a modification
                const modification = this.modifications.find(mod =>
                    mod.start <= result.valueStart && mod.end >= result.valueEnd);

                let arrayBuilder: ArrayBuilder;

                if (modification) {
                    // Extract just the array content from the modification
                    const arrayContent = modification.replacement.substring(
                        modification.replacement.indexOf('['),
                        modification.replacement.lastIndexOf(']') + 1
                    );

                    arrayBuilder = new TypeScriptArrayBuilder(
                        arrayContent,  // Use array content directly
                        1,            // Skip the opening [
                        arrayContent.length - 1,  // Skip the closing ]
                        this.modifications
                    );
                } else {
                    arrayBuilder = new TypeScriptArrayBuilder(
                        this.sourceText,
                        result.valueStart + 1,
                        result.valueEnd - 1,
                        this.modifications
                    );
                }

                if (options.onFound) {
                    options.onFound(arrayBuilder);  // Pass the ArrayBuilder instance directly
                }
            } else {
                DEBUG.log('TypeScriptObjectBuilder', 'findArray', `Array "${name}" not found`);
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
            }
        } catch (error) {
            DEBUG.log('TypeScriptObjectBuilder', 'findArray', 'Error finding array', {
                error: error instanceof Error ? error.message : String(error)
            });
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }

    setPropertyValue(name: string, value: string): void {
        DEBUG.log('TypeScriptObjectBuilder', 'setPropertyValue',
            `Setting value for property "${name}"`, { newValue: value });

        const result = this.findToken(name, null, { onFound: () => { } });

        if (result) {
            DEBUG.log('TypeScriptObjectBuilder', 'setPropertyValue',
                `Modifying property "${name}"`, {
                oldValue: this.sourceText.slice(result.valueStart, result.valueEnd),
                newValue: value
            });

            // Calculate correct end position
            let endPos = result.valueEnd;
            while (endPos > result.valueStart && /[\s\n]/.test(this.sourceText[endPos - 1])) {
                endPos--;
            }

            // Check if this is modifying a recently added property
            const recentAddition = this.modifications.find(mod =>
                mod.replacement.includes(`${name}:`));

            if (recentAddition) {
                // Find the array value in the recently added modification
                const propertyMatch = new RegExp(`(${name}:\\s*)(\\[.*?\\])`, 'g');
                recentAddition.replacement = recentAddition.replacement.replace(
                    propertyMatch,
                    `$1${value}`
                );
            } else {
                // Add a new modification for existing property
                this.modifications.push({
                    start: result.valueStart,
                    end: endPos,
                    replacement: value
                });
            }

            DEBUG.log('TypeScriptObjectBuilder', 'setPropertyValue',
                'Modified property', {
                name,
                newValue: value,
                modifications: this.modifications
            });
        } else {
            // Property not found - check recent modifications
            const recentMod = this.modifications.find(mod =>
                mod.replacement.includes(`${name}:`));

            if (recentMod) {
                // Update value in the modification
                const propertyMatch = new RegExp(`(${name}:\\s*)(\\[.*?\\])`, 'g');
                recentMod.replacement = recentMod.replacement.replace(
                    propertyMatch,
                    `$1${value}`
                );

                DEBUG.log('TypeScriptObjectBuilder', 'setPropertyValue',
                    'Updated recently added property', {
                    name,
                    newValue: value,
                    updatedModification: recentMod
                });
            }
        }
    }

    addProperty(name: string, value: string): void {
        DEBUG.log('TypeScriptObjectBuilder', 'addProperty', `Adding new property "${name}"`, {
            value
        });

        const needsComma = this.sourceText[this.endPos - 1].trim() !== '';
        const indent = this.getIndentation();

        let addition = (needsComma ? ',\n' : '\n') +
            indent + name + ': ' + value;

        DEBUG.log('TypeScriptObjectBuilder', 'addProperty', 'Adding property with formatting', {
            addition
        });

        this.modifications.push({
            start: this.endPos,
            end: this.endPos,
            replacement: addition
        });
    }

    addArray(name: string, callback: (builder: ArrayBuilder) => void): void {
        DEBUG.log('TypeScriptObjectBuilder', 'addArray', `Adding new array "${name}"`);

        // Check if there's a previous property that needs a comma
        const beforeText = this.sourceText.slice(this.startPos, this.endPos).trim();
        const needsComma = beforeText && beforeText.length > 0 && !beforeText.endsWith(',');

        const indent = this.getIndentation();

        // Create initial array text with consistent formatting and comma
        const arrayText = `${needsComma ? ',' : ''}\n${indent}${name}: []`;

        // Find the correct position to insert - before the closing brace
        let insertPos = this.endPos;
        while (insertPos > this.startPos && /[\s\n}]/.test(this.sourceText[insertPos - 1])) {
            insertPos--;
        }

        // Add the new array to modifications
        this.modifications.push({
            start: insertPos,
            end: insertPos,
            replacement: arrayText
        });

        DEBUG.log('TypeScriptObjectBuilder', 'addArray', 'Added new array', {
            arrayName: name,
            addedText: arrayText,
            insertPosition: insertPos
        });
    }



    private getIndentation(): string {
        DEBUG.log('TypeScriptObjectBuilder', 'getIndentation', 'Calculating indentation');

        let pos = this.startPos - 1;
        let indent = '';

        while (pos >= 0 && this.sourceText[pos] !== '\n') {
            pos--;
        }

        pos++;
        while (pos < this.sourceText.length && /[ \t]/.test(this.sourceText[pos])) {
            indent += this.sourceText[pos];
            pos++;
        }

        const finalIndent = indent + '    ';
        DEBUG.log('TypeScriptObjectBuilder', 'getIndentation', 'Calculated indentation', {
            indentLength: finalIndent.length,
            indent: finalIndent.replace(/ /g, '·').replace(/\t/g, '→')
        });

        return finalIndent;
    }
}





export class TypeScriptArrayBuilder implements ArrayBuilder {
    private sourceText: string;
    private startPos: number;
    private endPos: number;
    private modifications: CodeModification[];
    private items: ObjectBuilder[] = [];

    constructor(
        sourceText: string,
        startPos: number,
        endPos: number,
        modifications: CodeModification[]
    ) {
        this.sourceText = sourceText;
        this.startPos = startPos;
        this.endPos = endPos;
        this.modifications = modifications;

        DEBUG.log('TypeScriptArrayBuilder', 'constructor', 'Initialized new array builder', {
            textLength: sourceText.length,
            startPos,
            endPos,
            currentModifications: modifications.length
        });

        // Parse existing array items if any
        this.parseExistingItems();
    }

    addItem(value: string): void {
        DEBUG.log('TypeScriptArrayBuilder', 'addItem', `Adding new item: ${value}`);

        // Check if the array is empty or needs a comma
        const arrayContent = this.sourceText.slice(this.startPos, this.endPos).trim();
        const needsComma = arrayContent.length > 0;

        // Create the new item text with appropriate comma and formatting
        const itemText = `${needsComma ? ', ' : ''}${value}`;

        // Find the position of the closing bracket
        let insertPos = this.endPos;
        while (insertPos > this.startPos && /[\s\]]/.test(this.sourceText[insertPos - 1])) {
            insertPos--;
        }

        // Add to modifications at the correct position (before the closing bracket)
        this.modifications.push({
            start: insertPos,
            end: insertPos,
            replacement: itemText
        });

        DEBUG.log('TypeScriptArrayBuilder', 'addItem', 'Added item to array', {
            value,
            itemText,
            insertPosition: insertPos,
            modifications: this.modifications.length
        });
    }

    private parseExistingItems(): void {
        DEBUG.log('TypeScriptArrayBuilder', 'parseExistingItems', 'Starting to parse existing items');

        let currentPos = this.startPos;
        let inString = false;
        let stringChar = '';
        let braceLevel = 0;
        let bracketLevel = 0;
        let itemStart = -1;

        while (currentPos < this.endPos) {
            const char = this.sourceText[currentPos];
            const nextChar = currentPos + 1 < this.sourceText.length ?
                this.sourceText[currentPos + 1] : '';

            // Handle string literals
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
            } else if (inString && char === '\\' && nextChar === stringChar) {
                currentPos += 2;
                continue;
            } else if (inString && char === stringChar) {
                inString = false;
            }

            if (!inString) {
                if (char === '{') {
                    braceLevel++;
                    if (braceLevel === 1 && bracketLevel === 0) {
                        itemStart = currentPos;
                    }
                } else if (char === '}') {
                    braceLevel--;
                    if (braceLevel === 0 && bracketLevel === 0 && itemStart !== -1) {
                        // Found complete object
                        const objectBuilder = new TypeScriptObjectBuilder(
                            this.sourceText,
                            itemStart + 1,
                            currentPos,
                            this.modifications
                        );
                        this.items.push(objectBuilder);
                        itemStart = -1;
                    }
                } else if (char === '[') {
                    bracketLevel++;
                } else if (char === ']') {
                    bracketLevel--;
                }
            }

            currentPos++;
        }

        DEBUG.log('TypeScriptArrayBuilder', 'parseExistingItems',
            `Parsed ${this.items.length} existing items`);
    }

    addNewObject(callback: (builder: ObjectBuilder) => void): void {
        DEBUG.log('TypeScriptArrayBuilder', 'addNewObject', 'Adding new object to array');

        const needsComma = this.items.length > 0;
        const indent = this.getIndentation();

        // Create new object text
        let objectText = `${needsComma ? ',' : ''}\n${indent}{`;

        // Create a temporary builder for the new object
        const tempBuilder = new TypeScriptObjectBuilder(
            objectText,
            objectText.length - 1,
            objectText.length,
            []  // temporary modifications array
        );

        // Let the callback configure the object
        callback(tempBuilder);

        // Get the modified object text
        const modifiedText = tempBuilder.toString();

        // Add closing brace with proper indentation
        const fullText = modifiedText + `\n${indent}}`;

        // Add to modifications
        this.modifications.push({
            start: this.endPos,
            end: this.endPos,
            replacement: fullText
        });

        // Create final object builder
        const objectBuilder = new TypeScriptObjectBuilder(
            this.sourceText + fullText,
            this.endPos + (needsComma ? 2 : 1) + indent.length,
            this.endPos + fullText.length - 1,
            this.modifications
        );

        this.items.push(objectBuilder);
        this.endPos += fullText.length;

        DEBUG.log('TypeScriptArrayBuilder', 'addNewObject', 'Added new object', {
            totalItems: this.items.length,
            addedText: fullText
        });
    }

    getItems(): ObjectBuilder[] {
        return this.items;
    }

    private getIndentation(): string {
        let baseIndent = '';
        let pos = this.startPos - 1;

        // Find the start of the line
        while (pos >= 0 && this.sourceText[pos] !== '\n') {
            pos--;
        }

        // Calculate base indentation
        pos++;
        while (pos < this.sourceText.length && /[ \t]/.test(this.sourceText[pos])) {
            baseIndent += this.sourceText[pos];
            pos++;
        }

        // Add one level of indentation
        return baseIndent + '    ';
    }
}




// Types for property tracking
interface PropertyChange {
    timestamp: number;
    propertyName: string;
    oldValue: string | undefined;
    newValue: string;
    type: 'add' | 'modify' | 'delete';
}

interface TrackedProperty {
    name: string;
    currentValue: string;
    type: PropertyType;
    required: boolean;
    validation?: (value: any) => boolean;
    history: PropertyChange[];
}

type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';

interface PropertyValidationError {
    propertyName: string;
    message: string;
    code: string;
    value?: string;
}

interface PropertyTrackingOptions {
    strictTypes?: boolean;
    trackHistory?: boolean;
    validateOnChange?: boolean;
    maxHistoryLength?: number;
}

export class PropertyTrackingObjectBuilder implements ObjectBuilder {
    private innerBuilder: ObjectBuilder;
    private trackedProperties: Map<string, TrackedProperty>;
    private options: PropertyTrackingOptions;
    private validationErrors: PropertyValidationError[];

    constructor(
        builder: ObjectBuilder,
        options: PropertyTrackingOptions = {}
    ) {
        this.innerBuilder = builder;
        this.trackedProperties = new Map();
        this.validationErrors = [];
        this.options = {
            strictTypes: options.strictTypes ?? true,
            trackHistory: options.trackHistory ?? true,
            validateOnChange: options.validateOnChange ?? true,
            maxHistoryLength: options.maxHistoryLength ?? 100
        };

        DEBUG.log('PropertyTrackingObjectBuilder', 'constructor', 'Initialized with options', {
            options: this.options
        });
    }

    // Register a property to be tracked
    registerProperty(
        name: string,
        type: PropertyType,
        options: {
            required?: boolean;
            validation?: (value: any) => boolean;
            initialValue?: string;
        } = {}
    ): void {
        DEBUG.log('PropertyTrackingObjectBuilder', 'registerProperty',
            `Registering property "${name}"`, { type, options });

        const trackedProp: TrackedProperty = {
            name,
            type,
            required: options.required ?? false,
            validation: options.validation,
            currentValue: '',
            history: []
        };

        this.trackedProperties.set(name, trackedProp);

        // Immediately find and record the initial value after registration
        this.innerBuilder.findProperty(name, {
            onFound: (value) => {
                trackedProp.currentValue = value;
                this.recordChange(name, undefined, value, 'add');
            },
            onNotFound: () => {
                if (options.initialValue) {
                    trackedProp.currentValue = options.initialValue;
                    this.recordChange(name, undefined, options.initialValue, 'add');
                }
            }
        });
    }

    // Implementation of ObjectBuilder interface methods
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        this.innerBuilder.findObject(name, {
            ...options,
            onFound: (builder) => {
                const trackingBuilder = new PropertyTrackingObjectBuilder(builder, this.options);
                options.onFound(trackingBuilder);
            }
        });
    }

    findProperty(name: string, options: PropertyBuilderOptions<any>): void {
        this.innerBuilder.findProperty(name, {
            ...options,
            onFound: (value) => {
                const trackedProp = this.trackedProperties.get(name);
                if (trackedProp) {
                    // Only record if this is the first time we're setting the value
                    if (!trackedProp.currentValue && trackedProp.history.length === 0) {
                        this.recordChange(name, undefined, value, 'add');
                    }
                    trackedProp.currentValue = value;
                }
                options.onFound(value);
            }
        });
    }

    findArray(name: string, options: ArrayBuilderOptions): void {
        // Create a new options object that matches the ArrayBuilderOptions interface
        const arrayOptions: ArrayBuilderOptions = {
            ...options,
            onFound: options.onFound
                ? (builder: ArrayBuilder) => options.onFound!(builder)
                : undefined
        };
        this.innerBuilder.findArray(name, arrayOptions);
    }


    setPropertyValue(name: string, value: string): void {
        const trackedProp = this.trackedProperties.get(name);

        if (trackedProp) {
            // Validate type if strict typing is enabled
            if (this.options.strictTypes && !this.validateType(value, trackedProp.type)) {
                this.addValidationError(name, `Invalid type for property "${name}". Expected ${trackedProp.type}`, 'TYPE_ERROR', value);
                if (this.options.validateOnChange) {
                    return;
                }
            }

            // Run custom validation if provided
            if (trackedProp.validation && !trackedProp.validation(this.parseValue(value))) {
                this.addValidationError(name, `Validation failed for property "${name}"`, 'VALIDATION_ERROR', value);
                if (this.options.validateOnChange) {
                    return;
                }
            }

            // Record the change with the current value as old value
            this.recordChange(name, trackedProp.currentValue, value, 'modify');
            trackedProp.currentValue = value;
        }

        this.innerBuilder.setPropertyValue(name, value);
    }

    addProperty(name: string, value: string): void {
        const trackedProp = this.trackedProperties.get(name);

        if (trackedProp) {
            if (this.options.strictTypes && !this.validateType(value, trackedProp.type)) {
                this.addValidationError(name, `Invalid type for property "${name}". Expected ${trackedProp.type}`, 'TYPE_ERROR', value);
                if (this.options.validateOnChange) {
                    return;
                }
            }

            this.recordChange(name, undefined, value, 'add');
            trackedProp.currentValue = value;
        }

        this.innerBuilder.addProperty(name, value);
    }

    addArray(name: string, callback: (builder: ArrayBuilder) => void): void {
        this.innerBuilder.addArray(name, callback);
    }

    // Utility methods for property tracking
    private recordChange(
        propertyName: string,
        oldValue: string | undefined,
        newValue: string,
        type: PropertyChange['type']
    ): void {
        if (!this.options.trackHistory) return;

        const trackedProp = this.trackedProperties.get(propertyName);
        if (!trackedProp) return;

        const change: PropertyChange = {
            timestamp: Date.now(),
            propertyName,
            oldValue,
            newValue,
            type
        };

        trackedProp.history.push(change);

        // Trim history if it exceeds max length
        if (this.options.maxHistoryLength &&
            trackedProp.history.length > this.options.maxHistoryLength) {
            trackedProp.history = trackedProp.history.slice(-this.options.maxHistoryLength);
        }

        DEBUG.log('PropertyTrackingObjectBuilder', 'recordChange',
            `Recorded change for property "${propertyName}"`, { change });
    }

    private validateType(value: string, expectedType: PropertyType): boolean {
        try {
            // Special handling for string type - any value that can be represented as a string is valid
            if (expectedType === 'string') {
                return true; // All values can be strings
            }

            // Special handling for array string representations
            if (expectedType === 'array') {
                // Check if it looks like an array literal
                if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
                    try {
                        const arrayStr = value.replace(/'/g, '"'); // Replace single quotes with double quotes
                        JSON.parse(arrayStr);
                        return true;
                    } catch {
                        return false;
                    }
                }
                return false;
            }

            const parsed = this.parseValue(value);

            switch (expectedType) {
                case 'number':
                    return typeof parsed === 'number' && !isNaN(parsed);
                case 'boolean':
                    return typeof parsed === 'boolean';
                case 'object':
                    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
                case 'any':
                    return true;
                default:
                    return false;
            }
        } catch {
            return false;
        }
    }
    private parseValue(value: string): any {
        // Handle special values
        if (value === "null") return null;
        if (value === "undefined") return undefined;

        // Handle string literals
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }

        // Try regular JSON parse
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    private addValidationError(
        propertyName: string,
        message: string,
        code: string,
        value?: string
    ): void {
        const error: PropertyValidationError = {
            propertyName,
            message,
            code,
            value
        };

        this.validationErrors.push(error);
        DEBUG.log('PropertyTrackingObjectBuilder', 'addValidationError',
            `Validation error for property "${propertyName}"`, { error });
    }

    // Public methods for accessing tracking data
    getPropertyHistory(propertyName: string): PropertyChange[] {
        return this.trackedProperties.get(propertyName)?.history ?? [];
    }

    getValidationErrors(): PropertyValidationError[] {
        return [...this.validationErrors];
    }

    clearValidationErrors(): void {
        this.validationErrors = [];
    }

    validateAllProperties(): PropertyValidationError[] {
        this.clearValidationErrors();

        for (const [name, prop] of this.trackedProperties) {
            // Check required properties
            if (prop.required) {
                const value = this.parseValue(prop.currentValue);
                // Consider null, undefined, and "null"/"undefined" strings as empty values
                if (!value || value === null || value === "null" || value === "undefined") {
                    this.addValidationError(
                        name,
                        `Required property "${name}" is missing`,
                        'REQUIRED_ERROR'
                    );
                    continue;
                }
            }

            if (!prop.currentValue) continue;

            // Validate type
            if (this.options.strictTypes && !this.validateType(prop.currentValue, prop.type)) {
                this.addValidationError(
                    name,
                    `Invalid type for property "${name}". Expected ${prop.type}`,
                    'TYPE_ERROR',
                    prop.currentValue
                );
            }

            // Run custom validation
            if (prop.validation && !prop.validation(this.parseValue(prop.currentValue))) {
                this.addValidationError(
                    name,
                    `Validation failed for property "${name}"`,
                    'VALIDATION_ERROR',
                    prop.currentValue
                );
            }
        }

        return this.getValidationErrors();
    }

    getTrackedPropertyNames(): string[] {
        return Array.from(this.trackedProperties.keys());
    }

    getPropertyDetails(propertyName: string): TrackedProperty | undefined {
        return this.trackedProperties.get(propertyName);
    }
}