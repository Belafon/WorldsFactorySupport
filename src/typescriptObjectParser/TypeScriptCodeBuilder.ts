// Core interfaces for the builder pattern
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
    }

    parseText(text: string): void {
        this.sourceText = text;
        this.modifications = [];
    }

    /**
     * Should find an object by name and call callbacks
     * the matched object has to be on the first level of the source text,
     * so the nested should be skipped.
     * We have to see each parentheses to see the current level and if we can 
     * to match current object.
     */
    findObject(name: string, options: BuilderOptions<ObjectBuilder>): void {
        try {
            const matches = this.findFirstLevelMatches(name);

            if (matches.length === 0) {
                if (options.onNotFound) {
                    options.onNotFound(name);
                }
                return;
            }

            // Use the first valid match
            const match = matches[0];
            const bodyPosition = this.extractObjectBody(match.index);

            const builder = new TypeScriptObjectBuilder(
                this.sourceText,
                bodyPosition.start,
                bodyPosition.end,
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

    /**
     * Finds all matches for an object name that appear at the first level of nesting
     */
    private findFirstLevelMatches(name: string): { index: number; length: number }[] {
        const regex = REGEX_PATTERNS.OBJECT_START(name);
        const matches: { index: number; length: number }[] = [];
        let braceLevel = 0;
        let currentPos = 0;

        while (currentPos < this.sourceText.length) {
            // Skip if we're inside a string literal
            if (this.isWithinStringLiteral(currentPos)) {
                currentPos++;
                continue;
            }

            // Check for braces first to maintain correct level count
            if (this.sourceText[currentPos] === '{') {
                braceLevel++;
            } else if (this.sourceText[currentPos] === '}') {
                braceLevel--;
            }

            // Only look for matches at the first level (braceLevel === 0)
            if (braceLevel === 0) {
                regex.lastIndex = currentPos;
                const match = regex.exec(this.sourceText);

                if (!match) {
                    break;
                }

                // Skip this match if it's within a string literal
                if (this.isWithinStringLiteral(match.index)) {
                    currentPos = match.index + 1;
                    continue;
                }

                // Verify this is actually a first-level match by checking
                // if any nested braces occurred between currentPos and match.index
                let isValidMatch = true;
                let tempBraceLevel = 0;

                for (let i = currentPos; i < match.index; i++) {
                    // Skip checking braces if we're in a string literal
                    if (this.isWithinStringLiteral(i)) {
                        continue;
                    }

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
                    matches.push({
                        index: match.index,
                        length: match[0].length
                    });
                }

                currentPos = match.index + 1;
            } else {
                currentPos++;
            }
        }

        return matches;
    }

    private isWithinStringLiteral(position: number): boolean {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let i = 0;

        while (i < position) {
            const char = this.sourceText[i];
            const prevChar = i > 0 ? this.sourceText[i - 1] : '';

            // Skip escaped quotes
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

        return inSingleQuote || inDoubleQuote;
    }

    private extractObjectBody(startPos: number): BodyRange {
        let braceCount = 0;
        let currentPos = startPos;
        let bodyStart = -1;

        // First, find the opening brace
        while (currentPos < this.sourceText.length && this.sourceText[currentPos] !== '{') {
            currentPos++;
        }

        // Now track braces
        while (currentPos < this.sourceText.length) {
            const char = this.sourceText[currentPos];

            if (char === '{') {
                braceCount++;
                // Mark the start position after we've found the opening brace
                if (braceCount === 1) {
                    bodyStart = currentPos + 1;
                    currentPos++;
                    continue;
                }
            }
            if (char === '}') {
                braceCount--;
                // Found the closing brace
                if (braceCount === 0) {
                    return {
                        start: bodyStart,
                        end: currentPos
                    };
                }
            }

            currentPos++;
        }

        throw new Error('Invalid object structure: missing closing brace');
    }

    toString(): string {
        // Sort modifications in reverse order to apply from end to start
        const sortedMods = [...this.modifications].sort((a, b) => b.start - a.start);

        let result = this.sourceText;
        for (const mod of sortedMods) {
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
        console.log(`\nSearching for property "${name}" in text:\n${this.sourceText}`);
        console.log(`Search boundaries: start=${this.startPosition}, end=${this.endPosition}`);
    
        const regex = REGEX_PATTERNS.PROPERTY(name);
        const matches: { index: number; valueStart: number; valueEnd: number }[] = [];
        let currentPos = this.startPosition;
        
        const isValidPropertyPosition = (pos: number): boolean => {
            let braceCount = 0;
            let inString = false;
            let prevChar = '';
    
            console.log(`\nChecking position ${pos} for valid nesting level`);
            let debugText = '';
    
            // Start from the beginning of our object scope
            for (let i = this.startPosition; i < pos; i++) {
                const char = this.sourceText[i];
                debugText += char;
    
                // Handle string context
                if ((char === '"' || char === "'") && prevChar !== '\\') {
                    inString = !inString;
                    console.log(`${i}: ${char} - String context changed to: ${inString}`);
                } else if (!inString) {
                    // Count braces only when not in string
                    if (char === '{') {
                        braceCount++;
                        console.log(`${i}: { - Brace level increased to: ${braceCount}`);
                    } else if (char === '}') {
                        braceCount--;
                        console.log(`${i}: } - Brace level decreased to: ${braceCount}`);
                    }
                }
                prevChar = char;
            }
    
            console.log(`Text processed before position: ${debugText}`);
            console.log(`Final brace count: ${braceCount}, Expected: 1`);
            return braceCount === 1;
        };
        
        while (currentPos < this.endPosition) {
            // Try to find the next property match
            regex.lastIndex = currentPos;
            const searchText = this.sourceText.slice(currentPos, this.endPosition);
            const match = regex.exec(searchText);
            
            if (!match) {
                console.log('No more matches found');
                break;
            }
    
            const absoluteIndex = currentPos + match.index;
            console.log(`\nFound potential match at position ${absoluteIndex}`);
            console.log(`Matched text: "${match[0]}"`);
    
            // Skip if match is within a string literal
            if (this.isWithinStringLiteral(absoluteIndex)) {
                console.log('Match is within string literal - skipping');
                currentPos = absoluteIndex + 1;
                continue;
            }
    
            // Check if this property is at the correct nesting level
            if (isValidPropertyPosition(absoluteIndex)) {
                console.log('Match is at valid nesting level');
                
                // Verify the match isn't part of a longer property name
                const beforeChar = absoluteIndex > 0 ? this.sourceText[absoluteIndex - 1] : '';
                const isValidStart = /^[,{\s]$/.test(beforeChar) || absoluteIndex === 0;
    
                if (isValidStart) {
                    console.log('Match has valid start character');
                    // Extract the value positions
                    const valueStart = absoluteIndex + match[0].length - match[1].length;
                    const valueEnd = valueStart + match[1].length;
    
                    console.log(`Value boundaries: start=${valueStart}, end=${valueEnd}`);
                    console.log(`Value text: "${this.sourceText.slice(valueStart, valueEnd)}"`);
    
                    matches.push({
                        index: absoluteIndex,
                        valueStart,
                        valueEnd
                    });
                } else {
                    console.log(`Invalid start character: "${beforeChar}"`);
                }
            } else {
                console.log('Match is at wrong nesting level - skipping');
            }
    
            currentPos = absoluteIndex + 1;
        }
    
        console.log(`\nTotal matches found: ${matches.length}`);
        matches.forEach((match, i) => {
            console.log(`Match ${i + 1}:`);
            console.log(`  Position: ${match.index}`);
            console.log(`  Value: "${this.sourceText.slice(match.valueStart, match.valueEnd)}"`);
        });
    
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
        console.log(`\nChecking if position ${position} is within string`);
    
        while (i < position) {
            const char = this.sourceText[i];
            debugText += char;
            
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                inString = !inString;
                console.log(`${i}: ${char} - String context changed to: ${inString}`);
            }
            
            prevChar = char;
            i++;
        }
    
        console.log(`Text processed: ${debugText}`);
        console.log(`Final string state: ${inString}`);
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