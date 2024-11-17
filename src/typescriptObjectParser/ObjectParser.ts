type BasicValue = string | number | boolean | null;
type ArrayValue = Array<Value>;
type ObjectValue = { [key: string]: Value };
type FunctionValue = string; // Represents function body as string
type Value = BasicValue | ArrayValue | ObjectValue | FunctionValue;

interface ObjectLocation {
    path: string[];
    startIndex: number;
    endIndex: number;
    type: 'object' | 'array' | 'function' | 'basic';
}

interface ParsedProperty {
    name: string;
    type?: string;
    value: Value;
    location: ObjectLocation;
}

interface ParsedObject {
    name: string;
    type?: string;
    properties: ParsedProperty[];
    location: ObjectLocation;
}

interface Token {
    type: TokenType;
    value: string;
    position: number;
}

type TokenType = 
    | 'identifier'
    | 'operator'
    | 'string'
    | 'number'
    | 'punctuation'
    | 'keyword'
    | 'whitespace'
    | 'comment';

class TokenStream {
    private tokens: Token[];
    private current: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    peek(): Token | null {
        return this.tokens[this.current] || null;
    }

    next(): Token | null {
        return this.tokens[this.current++] || null;
    }

    eof(): boolean {
        return this.peek() === null;
    }

    consumeWhitespace(): void {
        while (this.peek()?.type === 'whitespace') {
            this.next();
        }
    }
}

export class ObjectParser {
    private sourceCode: string;
    private tokens: Token[];
    private stream: TokenStream;
    private objects: Map<string, ParsedObject>;

    constructor(sourceCode: string) {
        this.sourceCode = sourceCode;
        this.tokens = this.tokenize(sourceCode);
        this.stream = new TokenStream(this.tokens);
        this.objects = new Map();
        this.parse();
    }

    private tokenize(code: string): Token[] {
        const tokens: Token[] = [];
        let current = 0;

        while (current < code.length) {
            let char = code[current];

            // Handle whitespace
            if (/\s/.test(char)) {
                let value = '';
                while (current < code.length && /\s/.test(code[current])) {
                    value += code[current];
                    current++;
                }
                tokens.push({ type: 'whitespace', value, position: current - value.length });
                continue;
            }

            // Handle comments
            if (char === '/' && code[current + 1] === '/') {
                let value = '';
                while (current < code.length && code[current] !== '\n') {
                    value += code[current];
                    current++;
                }
                tokens.push({ type: 'comment', value, position: current - value.length });
                continue;
            }

            // Handle strings
            if (char === '"' || char === "'") {
                const quote = char;
                let value = char;
                current++;

                while (current < code.length && code[current] !== quote) {
                    value += code[current];
                    current++;
                }
                value += quote;
                current++;

                tokens.push({ type: 'string', value, position: current - value.length });
                continue;
            }

            // Handle numbers
            if (/[0-9]/.test(char)) {
                let value = '';
                while (current < code.length && /[0-9.]/.test(code[current])) {
                    value += code[current];
                    current++;
                }
                tokens.push({ type: 'number', value, position: current - value.length });
                continue;
            }

            // Handle identifiers
            if (/[a-zA-Z_$]/.test(char)) {
                let value = '';
                while (current < code.length && /[a-zA-Z0-9_$]/.test(code[current])) {
                    value += code[current];
                    current++;
                }

                const type = ['const', 'let', 'var', 'function', 'export'].includes(value)
                    ? 'keyword'
                    : 'identifier';

                tokens.push({ type, value, position: current - value.length });
                continue;
            }

            // Handle operators and punctuation
            if (/[=:,{}[\]()<>+\-*/]/.test(char)) {
                tokens.push({
                    type: /[=+\-*/]/.test(char) ? 'operator' : 'punctuation',
                    value: char,
                    position: current
                });
                current++;
                continue;
            }

            // Skip unrecognized characters
            current++;
        }

        return tokens;
    }

    private parse(): void {
        while (!this.stream.eof()) {
            const token = this.stream.peek();
            
            if (!token) {
                break;
            }

            if (token.type === 'keyword' && (token.value === 'export' || token.value === 'const')) {
                const object = this.parseTopLevelObject();
                if (object) {
                    this.objects.set(object.name, object);
                }
            }

            this.stream.next();
        }
    }

    private parseTopLevelObject(): ParsedObject | null {
        let startIndex = this.stream.peek()?.position || 0;
        
        // Skip 'export' if present
        if (this.stream.peek()?.value === 'export') {
            this.stream.next();
            this.stream.consumeWhitespace();
        }

        // Expect 'const'
        if (this.stream.peek()?.value !== 'const') {
            return null;
        } 
        this.stream.next();
        this.stream.consumeWhitespace();

        // Get object name
        const nameToken = this.stream.peek();
        if (!nameToken || nameToken.type !== 'identifier') {
            return null;
        } 
        const name = nameToken.value;
        this.stream.next();
        this.stream.consumeWhitespace();

        // Parse type annotation if present
        let type: string | undefined;
        if (this.stream.peek()?.value === ':') {
            this.stream.next(); // Skip ':'
            this.stream.consumeWhitespace();
            type = this.parseType();
            this.stream.consumeWhitespace();
        }

        // Expect '='
        if (this.stream.peek()?.value !== '=') {
            return null;
        } 
        this.stream.next();
        this.stream.consumeWhitespace();

        // Parse object body
        const properties = this.parseObjectBody();
        const endIndex = this.stream.peek()?.position || this.sourceCode.length;

        return {
            name,
            type,
            properties,
            location: {
                path: [name],
                startIndex,
                endIndex,
                type: 'object'
            }
        };
    }

    private parseType(): string | undefined {
        let type = '';
        let depth = 0;
        
        while (!this.stream.eof()) {
            const token = this.stream.peek();
            if (!token) {
                break;
            }

            if (token.value === '<') {
                depth++;
            }
            
            if (token.value === '>') {
                depth--;
            }
            
            if (depth === 0 && token.value === '=') {
                break;
            }
            
            type += token.value;
            this.stream.next();
        }

        return type.trim() || undefined;
    }

    private parseObjectBody(): ParsedProperty[] {
        const properties: ParsedProperty[] = [];
        
        // Expect '{'
        if (this.stream.peek()?.value !== '{') {
            return properties;
        }
        this.stream.next();
        this.stream.consumeWhitespace();

        while (!this.stream.eof() && this.stream.peek()?.value !== '}') {
            const property = this.parseProperty();
            if (property) {
                properties.push(property);
            }
            this.stream.consumeWhitespace();
            
            // Skip comma if present
            if (this.stream.peek()?.value === ',') {
                this.stream.next();
                this.stream.consumeWhitespace();
            }
        }

        // Skip closing '}'
        if (this.stream.peek()?.value === '}') {
            this.stream.next();
        }

        return properties;
    }

    private parseProperty(): ParsedProperty | null {
        const startIndex = this.stream.peek()?.position || 0;
        
        // Get property name
        const nameToken = this.stream.peek();
        if (!nameToken || nameToken.type !== 'identifier') {
            return null;
        } 
        const name = nameToken.value;
        this.stream.next();
        this.stream.consumeWhitespace();

        // Parse type annotation if present
        let type: string | undefined;
        if (this.stream.peek()?.value === ':') {
            this.stream.next(); // Skip ':'
            this.stream.consumeWhitespace();
            type = this.parseType();
            this.stream.consumeWhitespace();
        }

        // Expect ':'
        if (this.stream.peek()?.value !== ':') {
            return null;
        } 
        this.stream.next();
        this.stream.consumeWhitespace();

        // Parse value
        const value = this.parseValue();
        const endIndex = this.stream.peek()?.position || this.sourceCode.length;

        return {
            name,
            type,
            value,
            location: {
                path: [name],
                startIndex,
                endIndex,
                type: this.getValueType(value)
            }
        };
    }

    private parseValue(): Value {
        const token = this.stream.peek();
        if (!token) {
            return null;
        } 

        switch (token.type) {
            case 'string':
                this.stream.next();
                return token.value.slice(1, -1); // Remove quotes

            case 'number':
                this.stream.next();
                return Number(token.value);

            case 'identifier':
                if (token.value === 'true' || token.value === 'false') {
                    this.stream.next();
                    return token.value === 'true';
                }
                if (token.value === 'null') {
                    this.stream.next();
                    return null;
                }
                return this.parseFunctionOrIdentifier();

            case 'punctuation':
                if (token.value === '[') {
                    return this.parseArray();
                }
                if (token.value === '{') {
                    return this.parseObjectLiteral();
                }
                return null;

            default:
                return null;
        }
    }

    private parseArray(): ArrayValue {
        const array: ArrayValue = [];
        
        // Skip opening '['
        this.stream.next();
        this.stream.consumeWhitespace();

        while (!this.stream.eof() && this.stream.peek()?.value !== ']') {
            const value = this.parseValue();
            if (value !== null) {
                array.push(value);
            }
            this.stream.consumeWhitespace();
            
            // Skip comma if present
            if (this.stream.peek()?.value === ',') {
                this.stream.next();
                this.stream.consumeWhitespace();
            }
        }

        // Skip closing ']'
        if (this.stream.peek()?.value === ']') {
            this.stream.next();
        }

        return array;
    }

    private parseObjectLiteral(): ObjectValue {
        const obj: ObjectValue = {};
        
        // Skip opening '{'
        this.stream.next();
        this.stream.consumeWhitespace();

        while (!this.stream.eof() && this.stream.peek()?.value !== '}') {
            const key = this.stream.peek();
            if (!key || key.type !== 'identifier') {
                break;
            }
            this.stream.next();
            this.stream.consumeWhitespace();

            // Skip ':'
            if (this.stream.peek()?.value === ':') {
                this.stream.next();
                this.stream.consumeWhitespace();
                
                const value = this.parseValue();
                if (value !== null) {
                    obj[key.value] = value;
                }
            }

            this.stream.consumeWhitespace();
            
            // Skip comma if present
            if (this.stream.peek()?.value === ',') {
                this.stream.next();
                this.stream.consumeWhitespace();
            }
        }

        // Skip closing '}'
        if (this.stream.peek()?.value === '}') {
            this.stream.next();
        }

        return obj;
    }

    private parseFunctionOrIdentifier(): string {
        let value = this.stream.peek()?.value || '';
        this.stream.next();
        return value;
    }

    private getValueType(value: Value): ObjectLocation['type'] {
        if (Array.isArray(value)) {
            return 'array';
        }
        if (typeof value === 'object' && value !== null) {
            return 'object';
        }
        if (typeof value === 'string' && value.includes('=>')) {
            return 'function';
        }
        return 'basic';
    }

    // Public API methods
    public findTopLevelObject(name: string): ParsedObject | null {
        return this.objects.get(name) || null;
    }

    public findProperty(object: ParsedObject, propertyPath: string[]): ParsedProperty | null {
        const [first, ...rest] = propertyPath;
        const property = object.properties.find(p => p.name === first);
        
        if (!property) {
            return null;
        } 
        if (rest.length === 0) {
            return property;
        }
        
        if (property.value && typeof property.value === 'object' && !Array.isArray(property.value)) {
            const nestedObj: ParsedObject = {
                name: property.name,
                properties: Object.entries(property.value).map(([k, v]) => ({
                    name: k,
                    value: v,
                    location: {
                        path: [...property.location.path, k],
                        startIndex: property.location.startIndex,
                        endIndex: property.location.endIndex,
                        type: this.getValueType(v)
                    }
                })),
                location: property.location
            };
            return this.findProperty(nestedObj, rest);
        }
        
        return null;
    }

    public addProperty(
        object: ParsedObject,
        propertyName: string,
        value: Value,
        type?: string
    ): { updatedCode: string; location: ObjectLocation } {
        const beforePart = this.sourceCode.slice(0, object.location.startIndex);
        const afterPart = this.sourceCode.slice(object.location.endIndex);
        
        const newProperty = `${propertyName}${type ? ': ' + type : ''}: ${this.stringifyValue(value)}`;
        const location: ObjectLocation = {
            path: [...object.location.path, propertyName],
            startIndex: object.location.startIndex,
            endIndex: object.location.startIndex + newProperty.length,
            type: this.getValueType(value)
        };

        const updatedCode = `${beforePart}${newProperty},${afterPart}`;
        return { updatedCode, location };
    }

    private stringifyValue(value: Value): string {
        if (value === null) {
            return 'null';
        }
        if (Array.isArray(value)) {
            return `[${value.map(v => this.stringifyValue(v)).join(', ')}]`;
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        if (typeof value === 'string') {
            return `'${value}'`;
        }
        return String(value);
    }

    public addToArray(
        property: ParsedProperty,
        item: Value
    ): { updatedCode: string; location: ObjectLocation } {
        if (property.type !== 'array') {
            throw new Error('Property is not an array');
        }

        const currentArray = property.value as ArrayValue;
        const beforePart = this.sourceCode.slice(0, property.location.startIndex);
        const afterPart = this.sourceCode.slice(property.location.endIndex);
        
        const newArray = [...currentArray, item];
        const newArrayString = this.stringifyValue(newArray);
        
        const location: ObjectLocation = {
            path: property.location.path,
            startIndex: property.location.startIndex,
            endIndex: property.location.startIndex + newArrayString.length,
            type: 'array'
        };

        const updatedCode = `${beforePart}${property.name}: ${newArrayString}${afterPart}`;
        return { updatedCode, location };
    }

    public removeFromArray(
        property: ParsedProperty,
        itemToRemove: Value
    ): { updatedCode: string; location: ObjectLocation } {
        if (property.type !== 'array') {
            throw new Error('Property is not an array');
        }

        const currentArray = property.value as ArrayValue;
        const beforePart = this.sourceCode.slice(0, property.location.startIndex);
        const afterPart = this.sourceCode.slice(property.location.endIndex);
        
        const newArray = currentArray.filter(item => 
            this.stringifyValue(item) !== this.stringifyValue(itemToRemove)
        );
        const newArrayString = this.stringifyValue(newArray);
        
        const location: ObjectLocation = {
            path: property.location.path,
            startIndex: property.location.startIndex,
            endIndex: property.location.startIndex + newArrayString.length,
            type: 'array'
        };

        const updatedCode = `${beforePart}${property.name}: ${newArrayString}${afterPart}`;
        return { updatedCode, location };
    }

    public getModifiedCode(): string {
        return this.sourceCode;
    }

    // Helper methods for working with the parser
    private formatCode(code: string): string {
        // Simple formatting - you might want to use a proper formatter
        return code.replace(/\s+/g, ' ')
                  .replace(/{\s+/g, '{\n\t')
                  .replace(/,\s*/g, ',\n\t')
                  .replace(/}\s*/g, '\n}');
    }

    private getIndentation(code: string, position: number): string {
        const lastNewline = code.lastIndexOf('\n', position);
        if (lastNewline === -1) {
            return '';
        }
        
        const indent = code.slice(lastNewline + 1, position).match(/^\s*/);
        return indent ? indent[0] : '';
    }
}

// Helper class for managing code modifications
class CodeModifier {
    private modifications: Array<{
        startIndex: number;
        endIndex: number;
        newContent: string;
    }> = [];

    addModification(startIndex: number, endIndex: number, newContent: string): void {
        this.modifications.push({ startIndex, endIndex, newContent });
    }

    applyModifications(sourceCode: string): string {
        // Sort modifications in reverse order to avoid position conflicts
        this.modifications.sort((a, b) => b.startIndex - a.startIndex);

        let result = sourceCode;
        for (const mod of this.modifications) {
            result = result.slice(0, mod.startIndex) + 
                    mod.newContent + 
                    result.slice(mod.endIndex);
        }
        return result;
    }
}

// Example usage:
function example() {
    const code = `
        export const location: TLocation<'location'> = {
            id: 'location',
            name: _('Location Name'),
            description: \`\`,
            localCharacters: [],
            init: {}
        };
    `;

    const parser = new ObjectParser(code);
    
    // Find the location object
    const locationObj = parser.findTopLevelObject('location');
    if (locationObj) {
        // Find the localCharacters property
        const localCharacters = parser.findProperty(locationObj, ['localCharacters']);
        if (localCharacters) {
            // Add a new character
            const result = parser.addToArray(localCharacters, {
                name: 'New Character',
                description: 'Character description'
            });
            
            // Use the updated code
            console.log(result.updatedCode);
        }
    }
}

// Additional utility types for specific use cases
type ParserResult<T> = {
    success: boolean;
    value?: T;
    error?: string;
    position?: number;
};

interface ParserOptions {
    preserveFormatting?: boolean;
    indentSize?: number;
    quoteStyle?: 'single' | 'double';
}

// Export types for public API
export type {
    BasicValue,
    ArrayValue,
    ObjectValue,
    FunctionValue,
    Value,
    ObjectLocation,
    ParsedProperty,
    ParsedObject,
    ParserResult,
    ParserOptions
};