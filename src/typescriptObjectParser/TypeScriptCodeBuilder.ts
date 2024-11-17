// Core interfaces for the builder pattern
interface BuilderOptions<T> {
    onFound: (value: T) => void;
    onNotFound?: (name: string) => void;
    onError?: (error: Error) => void;
}

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


interface PropertyBuilderOptions<T> extends BuilderOptions<T> {
    propertyType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validation?: (value: T) => boolean;
}

interface ArrayBuilderOptions<T> extends BuilderOptions<T[]> {
    itemType?: 'string' | 'number' | 'boolean' | 'object';
    validation?: (items: T[]) => boolean;
}

interface CodeBuilder {
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void;
    parseText(text: string): void;
    toString(): string;
}

interface ObjectBuilder {
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void;
    findProperty(name: string, options: PropertyBuilderOptions<any>): void;
    findArray(name: string, options: ArrayBuilderOptions<any>): void;
    setPropertyValue(name: string, value: string): void;
    addProperty(name: string, value: string): void;
    addArray(name: string, callback: (builder: ArrayBuilder) => void): void;
}

interface ArrayBuilder {
    addNewObject(callback: (builder: ObjectBuilder) => void): void;
    getItems(): ObjectBuilder[];
}

type BodyRange = {
    start: number;
    end: number;
}

// Helper types for managing code modifications
export type CodeModification = {
    start: number;
    end: number;
    replacement: string;
};

// Regex patterns for parsing TypeScript code
const REGEX_PATTERNS = {
    OBJECT_START: (name: string) => new RegExp(
        // Match either property definition or variable declaration
        `(?:${name}\\s*:\\s*{|(?:export\\s+)?(?:const\\s+)?${name}\\s*=\\s*{)`,
        'g'
    ),
    ARRAY_START: (name: string) => new RegExp(
        // Match either property definition or variable declaration for arrays
        `(?:${name}\\s*:\\s*\\[|(?:export\\s+)?(?:const\\s+)?${name}\\s*=\\s*\\[)`,
        'g'
    ),
    PROPERTY: (name: string) => new RegExp(
        `${name}\\s*:\\s*([^,}\\n]+)`,
        'g'
    ),
    INDENTATION: /^[\s\t]*/,
    CLOSING_BRACE: /}/,
    CLOSING_BRACKET: /]/,
} as const;

// Main TypeScript code builder implementation

export class TypeScriptCodeBuilder implements CodeBuilder {
    private sourceText: string = '';
    private modifications: CodeModification[] = [];

    constructor() {
        this.sourceText = '';
        this.modifications = [];
        DEBUG.log('TypeScriptCodeBuilder', 'constructor', 'Initialized new builder');
    }

    parseText(text: string): void {
        DEBUG.log('TypeScriptCodeBuilder', 'parseText', 'Parsing new text', {
            textLength: text.length,
            firstChars: text.substring(0, 50) + '...'
        });
        this.sourceText = text;
        this.modifications = [];
    }

    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        DEBUG.log('TypeScriptCodeBuilder', 'findObject', `Searching for object "${name}"`);
        
        try {
            const matches = this.findFirstLevelMatches(name);
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', `Found ${matches.length} potential matches`, { matches });

            if (matches.length === 0) {
                DEBUG.log('TypeScriptCodeBuilder', 'findObject', `No matches found for "${name}"`);
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            const match = matches[0];
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', 'Using first match', { 
                index: match.index,
                length: match.length,
                matchedText: this.sourceText.substring(match.index, match.index + match.length)
            });

            const bodyPosition = this.extractObjectBody(match.index);
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', 'Extracted object body', {
                start: bodyPosition.start,
                end: bodyPosition.end,
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
            DEBUG.log('TypeScriptCodeBuilder', 'findObject', 'Error occurred', { error });
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }

    private findFirstLevelMatches(name: string): { index: number; length: number }[] {
        DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', `Starting search for "${name}"`);
        
        const regex = REGEX_PATTERNS.OBJECT_START(name);
        const matches: { index: number; length: number }[] = [];
        let braceLevel = 0;
        let currentPos = 0;

        while (currentPos < this.sourceText.length) {
            if (this.isWithinStringLiteral(currentPos)) {
                currentPos++;
                continue;
            }

            if (this.sourceText[currentPos] === '{') {
                braceLevel++;
                DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', `Brace level increased to ${braceLevel}`, {
                    position: currentPos
                });
            } else if (this.sourceText[currentPos] === '}') {
                braceLevel--;
                DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', `Brace level decreased to ${braceLevel}`, {
                    position: currentPos
                });
            }

            if (braceLevel === 0) {
                regex.lastIndex = currentPos;
                const match = regex.exec(this.sourceText);

                if (!match) {
                    break;
                }

                DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', 'Found potential match', {
                    position: match.index,
                    text: match[0]
                });

                if (this.isWithinStringLiteral(match.index)) {
                    DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', 'Match is within string literal, skipping');
                    currentPos = match.index + 1;
                    continue;
                }

                let isValidMatch = true;
                let tempBraceLevel = 0;

                for (let i = currentPos; i < match.index; i++) {
                    if (this.isWithinStringLiteral(i)) continue;

                    if (this.sourceText[i] === '{') {
                        tempBraceLevel++;
                    } else if (this.sourceText[i] === '}') {
                        tempBraceLevel--;
                    }

                    if (tempBraceLevel > 0) {
                        isValidMatch = false;
                        break;
                    }
                }

                if (isValidMatch) {
                    DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', 'Valid match found', {
                        index: match.index,
                        length: match[0].length,
                        text: match[0]
                    });
                    matches.push({
                        index: match.index,
                        length: match[0].length
                    });
                } else {
                    DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', 'Invalid match - nested object');
                }

                currentPos = match.index + 1;
            } else {
                currentPos++;
            }
        }

        DEBUG.log('TypeScriptCodeBuilder', 'findFirstLevelMatches', `Search complete. Found ${matches.length} matches`, { matches });
        return matches;
    }

    private isWithinStringLiteral(position: number): boolean {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let i = 0;

        while (i < position) {
            const char = this.sourceText[i];
            const prevChar = i > 0 ? this.sourceText[i - 1] : '';

            if (prevChar === '\\') {
                i++;
                continue;
            }

            if (char === "'") {
                inSingleQuote = !inSingleQuote;
            } else if (char === '"') {
                inDoubleQuote = !inDoubleQuote;
            }

            i++;
        }

        if (inSingleQuote || inDoubleQuote) {
            DEBUG.log('TypeScriptCodeBuilder', 'isWithinStringLiteral', `Position ${position} is within string literal`);
        }
        return inSingleQuote || inDoubleQuote;
    }

    private extractObjectBody(startPos: number): BodyRange {
        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', `Starting extraction from position ${startPos}`);
        
        let braceCount = 0;
        let currentPos = startPos;
        let bodyStart = -1;

        while (currentPos < this.sourceText.length && this.sourceText[currentPos] !== '{') {
            currentPos++;
        }

        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', `Found opening brace at ${currentPos}`);

        while (currentPos < this.sourceText.length) {
            const char = this.sourceText[currentPos];

            if (char === '{') {
                braceCount++;
                if (braceCount === 1) {
                    bodyStart = currentPos + 1;
                    DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', `Body starts at ${bodyStart}`);
                    currentPos++;
                    continue;
                }
            }
            if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', 'Body extraction complete', {
                        start: bodyStart,
                        end: currentPos,
                        body: this.sourceText.substring(bodyStart, currentPos)
                    });
                    return {
                        start: bodyStart,
                        end: currentPos
                    };
                }
            }

            currentPos++;
        }

        DEBUG.log('TypeScriptCodeBuilder', 'extractObjectBody', 'Error: Missing closing brace');
        throw new Error('Invalid object structure: missing closing brace');
    }

    toString(): string {
        DEBUG.log('TypeScriptCodeBuilder', 'toString', `Applying ${this.modifications.length} modifications`);
        
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

        return result;
    }
}










export class TypeScriptObjectBuilder implements ObjectBuilder {
    constructor(
        private sourceText: string,
        private startPosition: number,
        private endPosition: number,
        private modifications: CodeModification[]
    ) { }

    findProperty(name: string, options: PropertyBuilderOptions<any>): void {
        try {
            const matches = this.findFirstLevelProperties(name);

            if (matches.length === 0) {
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            // Use the first valid match
            const match = matches[0];
            const value = this.sourceText.slice(match.valueStart, match.valueEnd).trim();
            options.onFound(value);

        } catch (error) {
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }

    findArray(name: string, options: ArrayBuilderOptions<any>): void {
        try {
            const matches = this.findFirstLevelArrays(name);

            if (matches.length === 0) {
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            // Use the first valid match
            const match = matches[0];
            const bodyPosition = this.extractArrayBody(match.index);

            const arrayBuilder = new TypeScriptArrayBuilder(
                this.sourceText,
                bodyPosition.start,
                bodyPosition.end,
                this.modifications
            );

            options.onFound(arrayBuilder.getItems());

        } catch (error) {
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }
    private findFirstLevelProperties(name: string): { index: number; valueStart: number; valueEnd: number }[] {

        // Create regex that matches the property anywhere in text
        const regex = new RegExp(`${name}\\s*:\\s*([^,}\\n]+)`, 'g');
        const matches: { index: number; valueStart: number; valueEnd: number }[] = [];

        const isValidPropertyPosition = (pos: number): boolean => {
            let braceCount = 0;
            let inString = false;
            let prevChar = '';

            let debugText = '';

            // Start from the beginning of our object scope
            for (let i = this.startPosition; i < pos; i++) {
                const char = this.sourceText[i];
                debugText += char;

                // Handle string context
                if ((char === '"' || char === "'") && prevChar !== '\\') {
                    inString = !inString;
                } else if (!inString) {
                    // Count braces only when not in string
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }
                }
                prevChar = char;
            }

            return braceCount === 1;
        };

        // Find all matches in the text
        let match;
        while ((match = regex.exec(this.sourceText)) !== null) {
            const absoluteIndex = match.index;

            // Skip if outside our boundaries
            if (absoluteIndex < this.startPosition || absoluteIndex >= this.endPosition) {
                continue;
            }


            // Skip if match is within a string literal
            if (this.isWithinStringLiteral(absoluteIndex)) {
                continue;
            }

            // Check if this property is at the correct nesting level
            if (isValidPropertyPosition(absoluteIndex)) {

                // Verify the match isn't part of a longer property name
                const beforeChar = absoluteIndex > 0 ? this.sourceText[absoluteIndex - 1] : '';
                const isValidStart = /^[,{\s]$/.test(beforeChar) || absoluteIndex === 0;

                if (isValidStart) {
                    // Extract the value positions
                    const valueStart = absoluteIndex + match[0].length - match[1].length;
                    const valueEnd = valueStart + match[1].length;

                    matches.push({
                        index: absoluteIndex,
                        valueStart,
                        valueEnd
                    });
                }
            }
        }

        return matches;
    }


    private isObjectStructureValid(startPos: number, endPos: number): boolean {
        let braceCount = 0;
        let inString = false;
        let prevChar = '';

        for (let i = startPos; i < endPos; i++) {
            const char = this.sourceText[i];

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            prevChar = char;
        }

        return braceCount === 0;
    }

    private findFirstLevelArrays(name: string): { index: number; length: number }[] {
        // First check if the object structure is valid
        if (!this.isObjectStructureValid(this.startPosition, this.endPosition)) {
            throw new Error('Invalid object structure: unmatched braces');
        }

        const regex = REGEX_PATTERNS.ARRAY_START(name);
        const matches: { index: number; length: number }[] = [];
        let currentPos = this.startPosition;

        while (currentPos < this.endPosition) {
            // Try to find the next array match
            regex.lastIndex = currentPos;
            const searchText = this.sourceText.slice(currentPos, this.endPosition);
            const match = regex.exec(searchText);

            if (!match) {
                break;
            }

            const absoluteIndex = currentPos + match.index;

            // Skip if match is within a string literal
            if (this.isWithinStringLiteral(absoluteIndex)) {
                currentPos = absoluteIndex + 1;
                continue;
            }

            // Check if this array is at the root level
            const textBeforeMatch = this.sourceText.slice(this.startPosition, absoluteIndex);
            let braceCount = 0;
            let isInString = false;
            let prevChar = '';

            for (const char of textBeforeMatch) {
                if (char === '"' || char === "'") {
                    if (prevChar !== '\\') {
                        isInString = !isInString;
                    }
                } else if (!isInString) {
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }
                }
                prevChar = char;
            }

            // braceCount should be 1 for root level arrays (one for the object we're in)
            if (braceCount === 1) {
                // Verify array structure before adding the match
                try {
                    this.extractArrayBody(absoluteIndex);
                    matches.push({
                        index: absoluteIndex,
                        length: match[0].length
                    });
                } catch (error) {
                    if (error instanceof Error) {
                        throw new Error(`Invalid array structure for "${name}": ${error.message}`);
                    } else {
                        throw new Error(`Invalid array structure for "${name}": ${String(error)}`);
                    }
                }
            }

            currentPos = absoluteIndex + 1;
        }

        return matches;
    }


    private isWithinStringLiteral(position: number): boolean {
        let inString = false;
        let prevChar = '';
        let i = this.startPosition;

        let debugText = '';

        while (i < position) {
            const char = this.sourceText[i];
            debugText += char;

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
            }

            prevChar = char;
            i++;
        }

        return inString;
    }


    private extractArrayBody(startPos: number): BodyRange {
        let bracketCount = 0;
        let currentPos = startPos;
        let bodyStart = -1;
        let inString = false;
        let prevChar = '';

        // Find the opening bracket
        while (currentPos < this.endPosition && this.sourceText[currentPos] !== '[') {
            currentPos++;
            if (currentPos >= this.endPosition) {
                throw new Error('Array opening bracket not found');
            }
        }

        // Track brackets and string context
        while (currentPos < this.endPosition) {
            const char = this.sourceText[currentPos];

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
            } else if (!inString) {
                if (char === '[') {
                    bracketCount++;
                    if (bracketCount === 1) {
                        bodyStart = currentPos + 1;
                    }
                } else if (char === ']') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        return {
                            start: bodyStart,
                            end: currentPos
                        };
                    }
                }
            }

            prevChar = char;
            currentPos++;
        }

        throw new Error('Invalid array structure: missing closing bracket');
    }


    setPropertyValue(name: string, value: string): void {
        const matches = this.findFirstLevelProperties(name);
        if (matches.length > 0) {
            const match = matches[0];
            this.modifications.push({
                start: match.valueStart,
                end: match.valueEnd,
                replacement: value
            });
        }
    }

    addProperty(name: string, value: string): void {
        const indentMatch = REGEX_PATTERNS.INDENTATION.exec(
            this.sourceText.slice(this.startPosition, this.endPosition)
        );
        const indent = indentMatch ? indentMatch[0] : '    ';

        this.modifications.push({
            start: this.endPosition - 1,
            end: this.endPosition - 1,
            replacement: `\n${indent}${name}: ${value},`
        });
    }

    addArray(name: string, callback: (builder: ArrayBuilder) => void): void {
        const indentMatch = REGEX_PATTERNS.INDENTATION.exec(
            this.sourceText.slice(this.startPosition, this.endPosition)
        );
        const indent = indentMatch ? indentMatch[0] : '    ';

        const arrayBuilder = new TypeScriptArrayBuilder(
            this.sourceText,
            this.endPosition - 1,
            this.endPosition - 1,
            this.modifications
        );

        callback(arrayBuilder);

        const arrayContent = arrayBuilder.toString();
        const newArray = `\n${indent}${name}: ${arrayContent},`;

        this.modifications.push({
            start: this.endPosition - 1,
            end: this.endPosition - 1,
            replacement: newArray
        });
    }



    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        try {
            const matches = this.findFirstLevelObjects(name);

            if (matches.length === 0) {
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            // Use the first valid match
            const match = matches[0];
            const bodyRange = this.extractNestedObjectBody(match.index);

            const builder = new TypeScriptObjectBuilder(
                this.sourceText,
                bodyRange.start,
                bodyRange.end,
                this.modifications
            );

            options.onFound(builder);

        } catch (error) {
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            } else {
                throw error;
            }
        }
    }

    private findFirstLevelObjects(name: string): { index: number; length: number }[] {
        const regex = REGEX_PATTERNS.OBJECT_START(name);
        const matches: { index: number; length: number }[] = [];

        const isValidObjectPosition = (pos: number): boolean => {
            let braceCount = 0;
            let inString = false;
            let prevChar = '';

            // Start from the beginning of our object scope
            for (let i = this.startPosition; i < pos; i++) {
                const char = this.sourceText[i];

                // Handle string context
                if ((char === '"' || char === "'") && prevChar !== '\\') {
                    inString = !inString;
                } else if (!inString) {
                    // Count braces only when not in string
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }
                }
                prevChar = char;
            }

            // Should be exactly at level 1 (inside the current object)
            return braceCount === 1;
        };

        // Find all matches in the text between our boundaries
        let match;
        while ((match = regex.exec(this.sourceText)) !== null) {
            const absoluteIndex = match.index;

            // Skip if outside our boundaries
            if (absoluteIndex < this.startPosition || absoluteIndex >= this.endPosition) {
                continue;
            }

            // Skip if match is within a string literal
            if (this.isWithinStringLiteral(absoluteIndex)) {
                continue;
            }

            // Check if this object is at the correct nesting level
            if (isValidObjectPosition(absoluteIndex)) {
                // Verify the match isn't part of a longer name
                const beforeChar = absoluteIndex > 0 ? this.sourceText[absoluteIndex - 1] : '';
                const isValidStart = /^[,{\s]$/.test(beforeChar) || absoluteIndex === 0;

                if (isValidStart) {
                    matches.push({
                        index: absoluteIndex,
                        length: match[0].length
                    });
                }
            }
        }

        return matches;
    }

    private extractNestedObjectBody(startPos: number): BodyRange {
        let braceCount = 0;
        let currentPos = startPos;
        let bodyStart = -1;
        let inString = false;
        let prevChar = '';

        // Find the opening brace
        while (currentPos < this.endPosition && this.sourceText[currentPos] !== '{') {
            currentPos++;
            if (currentPos >= this.endPosition) {
                throw new Error('Object opening brace not found');
            }
        }

        // Track braces and string context
        while (currentPos < this.endPosition) {
            const char = this.sourceText[currentPos];

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    braceCount++;
                    if (braceCount === 1) {
                        bodyStart = currentPos + 1;
                    }
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        return {
                            start: bodyStart,
                            end: currentPos
                        };
                    }
                }
            }

            prevChar = char;
            currentPos++;
        }

        throw new Error('Invalid object structure: missing closing brace');
    }
}




























































class TypeScriptArrayBuilder implements ArrayBuilder {
    private items: ObjectBuilder[] = [];
    private newItemModifications: Map<number, string> = new Map();

    constructor(
        private sourceText: string,
        private startPosition: number,
        private endPosition: number,
        private modifications: CodeModification[]
    ) { }

    addNewObject(callback: (builder: ObjectBuilder) => void): void {
        const indentMatch = REGEX_PATTERNS.INDENTATION.exec(this.sourceText.slice(this.startPosition));
        const indent = indentMatch ? indentMatch[0] : '    ';

        // Create a temporary object to hold modifications
        const tempModifications: CodeModification[] = [];

        const objectBuilder = new TypeScriptObjectBuilder(
            this.sourceText,
            this.endPosition,
            this.endPosition,
            tempModifications
        );

        // Let the caller modify the object
        callback(objectBuilder);

        // Store the modifications for this item
        this.newItemModifications.set(this.items.length, this.processModifications(tempModifications));

        // Keep track of the builder for future reference
        this.items.push(objectBuilder);
    }

    getItems(): ObjectBuilder[] {
        return this.items;
    }

    toString(): string {
        if (this.items.length === 0) {
            return '[]';
        }

        const indentMatch = REGEX_PATTERNS.INDENTATION.exec(this.sourceText.slice(this.startPosition));
        const indent = indentMatch ? indentMatch[0] : '    ';
        const innerIndent = `${indent}    `;

        // Build array items string
        const itemStrings = Array.from(this.newItemModifications.values());

        // Join items with proper formatting
        const arrayContent = itemStrings
            .map(item => `${innerIndent}${item}`)
            .join(',\n');

        // Create the complete array string with proper indentation
        const arrayString = `[\n${arrayContent}\n${indent}]`;

        // Add the array modification
        this.modifications.push({
            start: this.startPosition,
            end: this.endPosition,
            replacement: arrayString
        });

        return arrayString;
    }

    private processModifications(itemModifications: CodeModification[]): string {
        // Sort modifications in reverse order
        const sortedMods = [...itemModifications].sort((a, b) => b.start - a.start);

        // Start with an empty object
        let objectContent = '{}';

        // Process each modification
        for (const mod of sortedMods) {
            // Extract the property name and value from the modification
            const propertyMatch = mod.replacement.match(/([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
            if (propertyMatch) {
                const [, propName, propValue] = propertyMatch;

                // If it's an empty object, replace it entirely
                if (objectContent === '{}') {
                    objectContent = `{ ${propName}: ${propValue.trim()} }`;
                } else {
                    // Insert the new property while preserving existing ones
                    objectContent = objectContent.replace(
                        /^{/,
                        `{ ${propName}: ${propValue.trim()}, `
                    );
                }
            }
        }

        return objectContent;
    }
}
// Usage example
function modifyTypeScriptCode(code: string): string {
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(code);

    builder.findObject('villageLocation', {
        onFound: (objectBuilder) => {
            objectBuilder.findArray('sublocations', {
                onFound: (builders) => {
                    for (const itemBuilder of builders) {
                        itemBuilder.findProperty('id', {
                            onFound: (id: any) => {
                                if (typeof id === 'string' && id !== null) {
                                    // sublocation already exists
                                    return;
                                } else {
                                    itemBuilder.setPropertyValue('id', `'newSublocation'`);
                                }
                            },
                            onNotFound: () => {
                                itemBuilder.setPropertyValue('id', `'newSublocation'`);
                            }
                        });
                    }
                },
                onNotFound: () => {
                    objectBuilder.addArray('sublocations', (newArrayBuilder) => {
                        newArrayBuilder.addNewObject((newObjectBuilder) => {
                            newObjectBuilder.setPropertyValue('id', `'newSublocation'`);
                        });
                    });
                }
            });
        },
        onNotFound: (name) => {
            throw new Error(`Location '${name}' not found`);
        }
    });

    return builder.toString();
}