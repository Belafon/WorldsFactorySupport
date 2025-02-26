/******************************************************
 * Debug flag for logging internal state.
 ******************************************************/
const DEBUG = true;

/******************************************************
 * Data structures to represent tokens & parsed items.
 ******************************************************/
export type ExtendedTokenType =
	| 'class'
	| 'interface'
	| 'type'
	| 'enum'
	| 'function'
	| 'variable'
	| 'whitespace'
	| 'unknown'
	| 'object' // for an entire { ... } literal
	| 'property' // for key: value
	| 'array' // for [ ... ] literal
	| 'literal'; // numbers, strings, booleans, etc.

export interface ParsedItemToken {
	type: ExtendedTokenType;
	name?: string;
	start: number;
	end: number;
	templateParams?: string;
}

/******************************************************
 * An abstraction to read through the source code by
 * index, avoiding copying large substrings.
 ******************************************************/
export class SourcePointer {
	private currentIndex = 0;

	constructor(private source: string) { }

	public get position(): number {
		return this.currentIndex;
	}

	public currentChar(): string {
		if (this.isEOF()) return '';
		const ch = this.source.charAt(this.currentIndex);
		if (DEBUG)
			console.log(
				`SourcePointer.currentChar: at index ${this.currentIndex} returns '${ch}'`
			);
		return ch;
	}

	public advance(): void {
		if (!this.isEOF()) {
			const oldIndex = this.currentIndex;
			const newIndex = this.currentIndex + 1;
			const substring = this.source.substring(oldIndex, newIndex);
			if (DEBUG)
				console.log(
					`SourcePointer.advance: from ${oldIndex} to ${newIndex}, substring: '${substring}'`
				);
			this.currentIndex = newIndex;
		}
	}

	public isEOF(): boolean {
		return this.currentIndex >= this.source.length;
	}

	public peek(offset: number = 0): string {
		const idx = this.currentIndex + offset;
		if (idx < 0 || idx >= this.source.length) {
			if (DEBUG)
				console.log(
					`SourcePointer.peek: index ${idx} is out of bounds, returning empty string`
				);
			return '';
		}
		const ch = this.source.charAt(idx);
		if (DEBUG)
			console.log(`SourcePointer.peek: at index ${idx} returns '${ch}'`);
		return ch;
	}

	public setPosition(newPos: number) {
		if (DEBUG)
			console.log(
				`SourcePointer.setPosition: from ${this.currentIndex} to ${newPos}`
			);
		this.currentIndex = Math.max(0, Math.min(newPos, this.source.length));
	}
}

/******************************************************
 * The tokenizer: scans the source and produces tokens.
 ******************************************************/
class TokenFactory {
	static createToken(
		type: ParsedItemToken['type'],
		start: number,
		end: number,
		name?: string,
		templateParams?: string
	): ParsedItemToken {
		const token = { type, start, end, name, templateParams };
		if (DEBUG) {
			console.log(
				`TokenFactory.createToken: created token ${JSON.stringify(token)}`
			);
		}
		return token;
	}
}

export class Tokenizer {
	private tokens: ParsedItemToken[] = [];

	constructor(private pointer: SourcePointer) { }

	public tokenize(): ParsedItemToken[] {
		if (DEBUG) console.log("Tokenizer.tokenize: starting tokenization");
		while (!this.pointer.isEOF()) {
			const startPos = this.pointer.position;
			const current = this.pointer.currentChar();
			if (DEBUG) {
				console.log(
					`Tokenizer.tokenize: at index ${startPos}, char '${current}'`
				);
			}

			// 1) Whitespace
			if (/\s/.test(current)) {
				this.consumeWhitespace();
				continue;
			}

			// 2) Identifiers or keywords
			if (isIdentifierStart(current)) {
				this.tokenizeIdentifierOrKeyword(startPos);
				continue;
			}

			// 3) Numbers
			if (/[0-9]/.test(current)) {
				this.tokenizeNumber(startPos);
				continue;
			}

			// 4) String literal
			if (current === "'" || current === '"') {
				this.tokenizeStringLiteral(startPos, current);
				continue;
			}

			// 5) Fallback for single-character punctuation: { } [ ] , : etc.
			//    We'll mark it as 'unknown' with a name = that character
			this.pointer.advance();
			const token = TokenFactory.createToken(
				'unknown',
				startPos,
				this.pointer.position,
				current
			);
			this.tokens.push(token);
			if (DEBUG)
				console.log(
					`Tokenizer.tokenize: created unknown token for char '${current}'`
				);
		}
		if (DEBUG) console.log("Tokenizer.tokenize: finished tokenization");
		return this.tokens;
	}

	private tokenizeNumber(startPos: number): void {
		if (DEBUG)
			console.log(`Tokenizer.tokenizeNumber: starting at index ${startPos}`);
		while (!this.pointer.isEOF() && /[0-9]/.test(this.pointer.currentChar())) {
			this.pointer.advance();
		}
		const endPos = this.pointer.position;
		const word = this.getSourceSlice(startPos, endPos);
		const token = TokenFactory.createToken('literal', startPos, endPos, word);
		this.tokens.push(token);
		if (DEBUG)
			console.log(
				`Tokenizer.tokenizeNumber: created literal token '${word}' from ${startPos} to ${endPos}, substring: '${this.getSourceSlice(
					startPos,
					endPos
				)}'`
			);
	}

	private tokenizeStringLiteral(startPos: number, quoteChar: string): void {
		if (DEBUG)
			console.log(
				`Tokenizer.tokenizeStringLiteral: starting at index ${startPos} with quote '${quoteChar}'`
			);
		this.pointer.advance(); // past the opening quote
		while (!this.pointer.isEOF() && this.pointer.currentChar() !== quoteChar) {
			this.pointer.advance();
		}
		if (!this.pointer.isEOF()) {
			this.pointer.advance(); // consume closing quote
		}
		const endPos = this.pointer.position;
		const value = this.getSourceSlice(startPos, endPos);
		const token = TokenFactory.createToken('literal', startPos, endPos, value);
		this.tokens.push(token);
		if (DEBUG)
			console.log(
				`Tokenizer.tokenizeStringLiteral: created literal token '${value}' from ${startPos} to ${endPos}, substring: '${this.getSourceSlice(
					startPos,
					endPos
				)}'`
			);
	}

	private consumeWhitespace(): void {
		const startPos = this.pointer.position;
		if (DEBUG)
			console.log(
				`Tokenizer.consumeWhitespace: starting at index ${startPos}`
			);
		while (!this.pointer.isEOF() && /\s/.test(this.pointer.currentChar())) {
			this.pointer.advance();
		}
		const endPos = this.pointer.position;
		const token = TokenFactory.createToken('whitespace', startPos, endPos);
		this.tokens.push(token);
		if (DEBUG)
			console.log(
				`Tokenizer.consumeWhitespace: consumed whitespace from ${startPos} to ${endPos}, substring: '${this.getSourceSlice(
					startPos,
					endPos
				)}'`
			);
	}

	private tokenizeIdentifierOrKeyword(startPos: number): void {
		if (DEBUG)
			console.log(
				`Tokenizer.tokenizeIdentifierOrKeyword: starting at index ${startPos}`
			);
		let endPos = startPos;
		while (
			!this.pointer.isEOF() &&
			isIdentifierPart(this.pointer.currentChar())
		) {
			this.pointer.advance();
		}
		endPos = this.pointer.position;

		const word = this.getSourceSlice(startPos, endPos);
		const recognizedType = classifyWord(word);

		if (recognizedType) {
			const token = TokenFactory.createToken(recognizedType, startPos, endPos);
			this.tokens.push(token);
			if (DEBUG)
				console.log(
					`Tokenizer.tokenizeIdentifierOrKeyword: recognized keyword '${word}' as type '${recognizedType}'`
				);
		} else {
			const token = TokenFactory.createToken('unknown', startPos, endPos, word);
			this.tokens.push(token);
			if (DEBUG)
				console.log(
					`Tokenizer.tokenizeIdentifierOrKeyword: unrecognized identifier '${word}', marked as unknown`
				);
		}
	}

	private getSourceSlice(start: number, end: number): string {
		return (this.pointer as any).source.substring(start, end);
	}
}

function isIdentifierStart(ch: string): boolean {
	return /[a-zA-Z_\$]/.test(ch);
}

function isIdentifierPart(ch: string): boolean {
	return /[a-zA-Z0-9_\$]/.test(ch);
}

function classifyWord(word: string): ParsedItemToken['type'] | undefined {
	switch (word) {
		case 'class':
			return 'class';
		case 'interface':
			return 'interface';
		case 'type':
			return 'type';
		case 'enum':
			return 'enum';
		case 'function':
			return 'function';
		case 'let':
		case 'const':
		case 'var':
			return 'variable';

		// Handle booleans as literal tokens:
		case 'true':
		case 'false':
			// You might also handle 'null', 'undefined', etc.
			return 'literal';

		default:
			return undefined;
	}
}

/******************************************************
 * A simple token stream to help consume tokens in order.
 ******************************************************/
export class TokenStream {
	private index = 0;
	constructor(private tokens: ParsedItemToken[]) { }

	public peek(): ParsedItemToken | null {
		return this.tokens[this.index] || null;
	}

	public next(): ParsedItemToken | null {
		if (this.isEOF()) return null;
		const token = this.tokens[this.index++];
		if (DEBUG)
			console.log(`TokenStream.next: returning token ${JSON.stringify(token)}`);
		return token;
	}

	public isEOF(): boolean {
		return this.index >= this.tokens.length;
	}

	public consumeWhitespace(): void {
		while (!this.isEOF() && this.peek()?.type === 'whitespace') {
			if (DEBUG)
				console.log("TokenStream.consumeWhitespace: consuming whitespace token");
			this.next();
		}
	}
}

/******************************************************
 * Parser for top-level TS constructs (classes, vars, etc.).
 ******************************************************/
export class TypeScriptBodyParser {
	private stream: TokenStream;
	constructor(private source: string) {
		const pointer = new SourcePointer(source);
		const tokenizer = new Tokenizer(pointer);
		const tokens = tokenizer.tokenize();
		if (DEBUG)
			console.log(
				`TypeScriptBodyParser: tokenization complete with ${tokens.length} tokens`
			);
		this.stream = new TokenStream(tokens);
	}

	private parseGenericTypeParams(): string | undefined {
		// Check if next token is '<'
		const ltToken = this.stream.peek();
		if (!ltToken || ltToken.name !== '<') {
			return undefined;
		}

		// Consume '<'
		this.stream.next();
		const templateStart = ltToken.start;

		// Collect everything until matching '>'.
		let depth = 1;
		let lastPos = ltToken.end;

		while (!this.stream.isEOF() && depth > 0) {
			const token = this.stream.next();
			if (!token) break;
			if (token.name === '<') {
				depth++;
			} else if (token.name === '>') {
				depth--;
				if (depth === 0) {
					lastPos = token.end;
					break;
				}
			}
			lastPos = token.end;
		}

		// Return the substring from `<` up through `>`
		const templateParams = this.source.substring(templateStart, lastPos);
		return templateParams;
	}

	public parseBody(): ParsedItemToken[] {
		const items: ParsedItemToken[] = [];
		if (DEBUG) console.log("TypeScriptBodyParser.parseBody: starting to parse body");

		// Consume any leading whitespace.
		this.stream.consumeWhitespace();

		// Peek at the first token.
		const token = this.stream.peek();

		// If the first non-whitespace token is '[' then the input is a top-level array literal.
		if (token && token.name === '[') {
			if (DEBUG) console.log("TypeScriptBodyParser.parseBody: detected top-level array literal");
			// Delegate parsing of the array literal to TypeScriptObjectParser.
			const objectParser = new TypeScriptObjectParser(this.stream, this.source);
			const arrayTokens = objectParser.parseArray();
			// The first token in the returned list is the outer array token.
			if (arrayTokens.length > 0) {
				items.push(arrayTokens[0]);
			}
		} else {
			// Otherwise, process recognized TS constructs (classes, interfaces, functions, variables, etc.).
			while (!this.stream.isEOF()) {
				this.stream.consumeWhitespace();
				const token = this.stream.peek();
				if (!token) break;

				switch (token.type) {
					case 'class':
					case 'interface':
					case 'type':
					case 'enum':
					case 'function':
					case 'variable': {
						// Note: parseItem now returns an array of tokens.
						const itemTokens = this.parseItem();
						items.push(...itemTokens);
						if (DEBUG)
							console.log(
								`TypeScriptBodyParser.parseBody: parsed items of type '${itemTokens[0].type}'`
							);
						break;
					}
					default:
						if (DEBUG)
							console.log(`TypeScriptBodyParser.parseBody: skipping token of type '${token.type}'`);
						this.stream.next(); // skip unhandled tokens
						break;
				}
			}
		}

		if (DEBUG)
			console.log(`TypeScriptBodyParser.parseBody: finished parsing body with ${items.length} items`);
		return items;
	}

	/**
	 * Parses an item (for example, a variable declaration) and returns one or more tokens.
	 * For a variable declaration with an initializer (like an array literal),
	 * it returns both the variable token and the initializer token.
	 */
	private parseItem(): ParsedItemToken[] {
		const tokens: ParsedItemToken[] = [];
		const startToken = this.stream.next();
		if (!startToken) {
			if (DEBUG)
				console.log("TypeScriptBodyParser.parseItem: no start token, returning unknown token");
			return [{ type: 'unknown', start: 0, end: 0 }];
		}

		const itemType = startToken.type; // e.g. 'variable'
		let itemName: string | undefined;
		let itemStart = startToken.start;
		let itemEnd = startToken.end;
		let templateParams: string | undefined;

		// For variable declarations, the next token should be the variable name.
		this.stream.consumeWhitespace();
		const nameToken = this.stream.peek();
		if (nameToken && nameToken.type === 'unknown') {
			itemName = nameToken.name;
			itemEnd = nameToken.end;
			this.stream.next(); // consume the name token
		}

		// After reading the name, check for generic type parameters.
		this.stream.consumeWhitespace();
		const maybeTemplateParams = this.parseGenericTypeParams();
		if (maybeTemplateParams) {
			templateParams = maybeTemplateParams;
			// Update the item end position accordingly.
			const templateEnd = itemStart + maybeTemplateParams.length;
			itemEnd = Math.max(itemEnd, templateEnd);
		}

		// Create the main token (e.g. the variable token).
		const mainToken: ParsedItemToken = {
			type: itemType,
			name: itemName,
			start: itemStart,
			end: itemEnd,
			templateParams
		};
		tokens.push(mainToken);

		// If this is a variable declaration, check for an initializer.
		if (itemType === 'variable') {
			this.stream.consumeWhitespace();
			const nextToken = this.stream.peek();
			if (nextToken && nextToken.name === '=') {
				// Consume the '=' token.
				this.stream.next();
				this.stream.consumeWhitespace();
				// Check if the initializer is an array literal or an object literal.
				const initializerToken = this.stream.peek();
				if (initializerToken && initializerToken.name === '[') {
					if (DEBUG)
						console.log("TypeScriptBodyParser.parseItem: detected array literal initializer");
					// Delegate to the array parser.
					const objectParser = new TypeScriptObjectParser(this.stream, this.source);
					const arrayTokens = objectParser.parseArray();
					if (arrayTokens.length > 0) {
						// Append the outer array token from the initializer.
						tokens.push(arrayTokens[0]);
					}
				} else if (initializerToken && initializerToken.name === '{') {
					if (DEBUG)
						console.log("TypeScriptBodyParser.parseItem: detected object literal initializer");
					// Delegate to the object parser.
					const objectParser = new TypeScriptObjectParser(this.stream, this.source);
					const objectTokens = objectParser.parseObject();
					if (objectTokens.length > 0) {
						// Append the object literal token from the initializer.
						tokens.push(objectTokens[0]);
					}
				}
			}
		}


		return tokens;
	}
}

/******************************************************
 * A naive parser for object, array, etc.
 ******************************************************/
export class TypeScriptObjectParser {
	constructor(private stream: TokenStream, private source: string) { }

	public parseObject(): ParsedItemToken[] {
		if (DEBUG) console.log("TypeScriptObjectParser.parseObject: starting to parse object");
		const tokens: ParsedItemToken[] = [];
		const openBrace = this.stream.peek();
		if (!openBrace || openBrace.name !== '{') {
			if (DEBUG)
				console.log(
					"TypeScriptObjectParser.parseObject: no opening '{' found, returning empty tokens"
				);
			return tokens;
		}
		// Create one top-level 'object' token
		const objectToken: ParsedItemToken = {
			type: 'object',
			start: openBrace.start,
			end: openBrace.end
		};
		tokens.push(objectToken);
		if (DEBUG)
			console.log(
				`TypeScriptObjectParser.parseObject: created object token starting at ${openBrace.start}`
			);
		this.stream.next(); // consume '{'
		let braceCount = 1;

		while (!this.stream.isEOF() && braceCount > 0) {
			this.stream.consumeWhitespace();
			const current = this.stream.peek();
			if (!current) break;

			if (current.name === '}') {
				objectToken.end = current.end; // close the object
				if (DEBUG)
					console.log(
						`TypeScriptObjectParser.parseObject: found closing '}', object ends at ${current.end}, substring: '${this.source.substring(
							current.start,
							current.end
						)}'`
					);
				braceCount--;
				this.stream.next(); // consume '}'
				break;
			}
			if (current.name === ',') {
				this.stream.next(); // skip comma
				if (DEBUG)
					console.log("TypeScriptObjectParser.parseObject: skipping comma");
				continue;
			}
			// parse a property
			const propertyTokens = this.parseProperty();
			tokens.push(...propertyTokens);
			if (DEBUG)
				console.log(
					`TypeScriptObjectParser.parseObject: parsed property with tokens ${JSON.stringify(
						propertyTokens
					)}`
				);
		}
		if (DEBUG)
			console.log("TypeScriptObjectParser.parseObject: finished parsing object");
		return tokens;
	}

	public parseProperty(): ParsedItemToken[] {
		if (DEBUG) console.log("TypeScriptObjectParser.parseProperty: starting to parse property");
		const tokens: ParsedItemToken[] = [];
		this.stream.consumeWhitespace();
		const keyToken = this.stream.peek();
		if (!keyToken || keyToken.name === '}' || keyToken.name === ',') {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseProperty: no valid property key found");
			return tokens; // no property here
		}
		// treat first token as property key
		const propStart = keyToken.start;
		const propKeyName = this.source.substring(keyToken.start, keyToken.end);
		const propToken: ParsedItemToken = {
			type: 'property',
			start: propStart,
			end: keyToken.end,
			name: propKeyName
		};
		tokens.push(propToken);
		if (DEBUG)
			console.log(
				`TypeScriptObjectParser.parseProperty: parsed property key '${propKeyName}'`
			);
		this.stream.next(); // consume key

		// consume optional colon + value
		this.stream.consumeWhitespace();
		const maybeColon = this.stream.peek();
		if (maybeColon && maybeColon.name === ':') {
			this.stream.next(); // consume ':'
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseProperty: found colon ':' after property key");
			this.stream.consumeWhitespace();
			const valueTokens = this.parseValue(propToken);
			tokens.push(...valueTokens);
			if (DEBUG)
				console.log(
					`TypeScriptObjectParser.parseProperty: parsed value tokens ${JSON.stringify(
						valueTokens
					)}`
				);
		}
		return tokens;
	}

	/**
	 * Parse a function expression starting at the 'function' keyword.
	 * Returns a single token of type 'function'.
	 * If the function has no name, use 'anonymous' as the token name.
	 */
	private parseFunctionExpression(): ParsedItemToken {
		// first token is guaranteed to be type === 'function'
		const functionKeywordToken = this.stream.next()!; // consume 'function'
		const startIndex = functionKeywordToken.start;

		// optional function name token
		let functionName = 'anonymous';
		this.stream.consumeWhitespace();
		const maybeNameToken = this.stream.peek();
		if (
			maybeNameToken &&
			maybeNameToken.type === 'unknown' && // possible function name
			maybeNameToken.name !== '(' // extra safety check
		) {
			functionName = maybeNameToken.name ?? 'anonymous';
			this.stream.next(); // consume the function name
		}

		// consume the parameter list: '(' ... ')'
		this.stream.consumeWhitespace();
		let endPos = functionKeywordToken.end;
		const maybeOpenParen = this.stream.peek();
		if (maybeOpenParen && maybeOpenParen.name === '(') {
			endPos = this.parseParenBlock('(', ')');
		}

		// consume the function body: '{' ... '}'
		this.stream.consumeWhitespace();
		const maybeOpenBrace = this.stream.peek();
		if (maybeOpenBrace && maybeOpenBrace.name === '{') {
			endPos = this.parseParenBlock('{', '}');
		}

		// produce a 'function' token from startIndex to endPos
		const funcToken: ParsedItemToken = {
			type: 'function',
			name: functionName,
			start: startIndex,
			end: endPos
		};
		return funcToken;
	}

	/**
	 * Helper: consumes everything from openSymbol to closeSymbol,
	 * including nested pairs, returning the end index.
	 */
	private parseParenBlock(openSymbol: string, closeSymbol: string): number {
		let openToken = this.stream.next()!; // e.g. '(' or '{'
		let depth = 1;
		let endPos = openToken.end;

		while (!this.stream.isEOF() && depth > 0) {
			const t = this.stream.next();
			if (!t) break;
			endPos = t.end;
			if (t.name === openSymbol) {
				depth++;
			} else if (t.name === closeSymbol) {
				depth--;
			}
		}
		return endPos;
	}

	private parseValue(_parentProp: ParsedItemToken): ParsedItemToken[] {
		if (DEBUG) console.log("TypeScriptObjectParser.parseValue: starting to parse value");
		const tokens: ParsedItemToken[] = [];
		this.stream.consumeWhitespace();
		const t = this.stream.peek();
		if (!t) {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseValue: no token found for value");
			return tokens;
		}

		// check for object
		if (t.name === '{') {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseValue: detected object literal");
			tokens.push(...this.parseObject());
			return tokens;
		}

		// check for array
		if (t.name === '[') {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseValue: detected array literal");
			tokens.push(...this.parseArray());
			return tokens;
		}

		// check for function expression
		if (t.type === 'function') {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseValue: detected function expression");
			const funcToken = this.parseFunctionExpression();
			tokens.push(funcToken);
			return tokens;
		}

		// otherwise treat as literal
		const lit = this.stream.next(); // consume
		if (lit) {
			const literalToken: ParsedItemToken = {
				type: 'literal',
				start: lit.start,
				end: lit.end,
				name: this.source.substring(lit.start, lit.end)
			};
			tokens.push(literalToken);
			if (DEBUG)
				console.log(
					`TypeScriptObjectParser.parseValue: parsed literal value '${literalToken.name}'`
				);
		}
		return tokens;
	}

	public parseArray(): ParsedItemToken[] {
		if (DEBUG) console.log("TypeScriptObjectParser.parseArray: starting to parse array");
		const tokens: ParsedItemToken[] = [];
		const openBracket = this.stream.peek();
		if (!openBracket || openBracket.name !== '[') {
			if (DEBUG)
				console.log("TypeScriptObjectParser.parseArray: no opening '[' found, returning empty tokens");
			return tokens;
		}
		// Create a top-level array token for this array literal.
		const arrToken: ParsedItemToken = {
			type: 'array',
			start: openBracket.start,
			end: openBracket.end
		};
		tokens.push(arrToken);
		if (DEBUG)
			console.log(`TypeScriptObjectParser.parseArray: created array token starting at ${openBracket.start}`);
		this.stream.next(); // consume '['
		let bracketCount = 1;
		// Flag to ensure that only the first nested array token is added.
		let nestedArrayTokenAdded = false;

		while (!this.stream.isEOF() && bracketCount > 0) {
			this.stream.consumeWhitespace();
			const current = this.stream.peek();
			if (!current) break;

			if (current.name === ']') {
				bracketCount--;
				arrToken.end = current.end;
				if (DEBUG)
					console.log(
						`TypeScriptObjectParser.parseArray: found closing ']', array ends at ${current.end}, substring: '${this.source.substring(current.start, current.end)}'`
					);
				this.stream.next(); // consume ']'
				break;
			}
			if (current.name === ',') {
				this.stream.next(); // skip comma
				if (DEBUG)
					console.log("TypeScriptObjectParser.parseArray: skipping comma");
				continue;
			}
			if (current.name === '{') {
				if (DEBUG)
					console.log("TypeScriptObjectParser.parseArray: detected nested object in array");
				const innerObjectTokens = this.parseObject();
				if (innerObjectTokens.length > 0) {
					tokens.push(innerObjectTokens[0]);
				}
				continue;
			}
			if (current.name === '[') {
				if (DEBUG)
					console.log("TypeScriptObjectParser.parseArray: detected nested array in array");
				const nestedArrTokens = this.parseArray();
				// Only add the first nested array token encountered.
				if (!nestedArrayTokenAdded && nestedArrTokens.length > 0) {
					tokens.push(nestedArrTokens[0]);
					nestedArrayTokenAdded = true;
				}
				// Continue without adding further nested array tokens.
				continue;
			}
			// Treat the token as a literal.
			const lit = this.stream.next();
			if (lit) {
				const literalToken: ParsedItemToken = {
					type: 'literal',
					start: lit.start,
					end: lit.end,
					name: this.source.substring(lit.start, lit.end)
				};
				tokens.push(literalToken);
				if (DEBUG)
					console.log(`TypeScriptObjectParser.parseArray: parsed literal array item '${literalToken.name}'`);
			}
		}
		if (DEBUG)
			console.log("TypeScriptObjectParser.parseArray: finished parsing array");
		return tokens;
	}

}

/******************************************************
 * A specialized parser for variable declarations
 ******************************************************/
export interface VariableAssignmentResult {
	variableKeyword: 'const' | 'let' | 'var' | 'unknown';
	variableName: string | undefined;
	initializer?: ParsedItemToken;
}

export class TypeScriptVariableParser {
	private stream: TokenStream;
	constructor(private source: string, tokensForVariable: ParsedItemToken[]) {
		this.stream = new TokenStream(tokensForVariable);
	}

	public parseVariable(): VariableAssignmentResult {
		if (DEBUG)
			console.log("TypeScriptVariableParser.parseVariable: starting variable parsing");
		this.stream.consumeWhitespace();
		let keyword = 'unknown' as VariableAssignmentResult['variableKeyword'];
		let variableName: string | undefined;
		let initializer: ParsedItemToken | undefined;

		// read 'const'/'let'/'var'
		const firstTok = this.stream.peek();
		if (firstTok && firstTok.type === 'variable') {
			const tokText = this.getTokenText(firstTok).trim();
			keyword = tokText as 'const' | 'let' | 'var';
			this.stream.next();
			if (DEBUG)
				console.log(
					`TypeScriptVariableParser.parseVariable: found variable keyword '${keyword}'`
				);
		}

		// read the variable name
		this.stream.consumeWhitespace();
		const nameTok = this.stream.peek();
		if (nameTok && nameTok.type === 'unknown') {
			variableName = this.getTokenText(nameTok);
			this.stream.next();
			if (DEBUG)
				console.log(
					`TypeScriptVariableParser.parseVariable: found variable name '${variableName}'`
				);
		}

		// check for '='
		this.stream.consumeWhitespace();
		const maybeEq = this.stream.peek();
		if (maybeEq && maybeEq.name === '=') {
			this.stream.next(); // consume '='
			if (DEBUG)
				console.log("TypeScriptVariableParser.parseVariable: found '=' for initializer");
			initializer = this.parseInitializer();
			if (DEBUG)
				console.log("TypeScriptVariableParser.parseVariable: parsed initializer");
		}

		return { variableKeyword: keyword, variableName, initializer };
	}

	private parseInitializer(): ParsedItemToken | undefined {
		if (DEBUG)
			console.log("TypeScriptVariableParser.parseInitializer: starting to parse initializer");
		this.stream.consumeWhitespace();
		const t = this.stream.peek();
		if (!t) return undefined;

		// object or array
		if (t.name === '{') {
			if (DEBUG)
				console.log("TypeScriptVariableParser.parseInitializer: detected object initializer");
			const parser = new TypeScriptObjectParser(this.stream, this.source);
			const tokens = parser.parseObject();
			return tokens.length > 0 ? tokens[0] : undefined;
		}
		if (t.name === '[') {
			if (DEBUG)
				console.log("TypeScriptVariableParser.parseInitializer: detected array initializer");
			const parser = new TypeScriptObjectParser(this.stream, this.source);
			const tokens = parser.parseArray();
			return tokens.length > 0 ? tokens[0] : undefined;
		}

		// otherwise literal
		const literalToken = this.stream.next();
		if (literalToken) {
			const token: ParsedItemToken = {
				type: 'literal',
				start: t.start,
				end: t.end,
				name: this.getTokenText(t)
			};
			if (DEBUG)
				console.log(
					`TypeScriptVariableParser.parseInitializer: parsed literal initializer '${token.name}'`
				);
			return token;
		}
		return undefined;
	}

	private getTokenText(tok: ParsedItemToken): string {
		return this.source.substring(tok.start, tok.end);
	}
}


/**
 * A dedicated parser for array literals.
 * It assumes the first token in the stream is '['
 * and will parse everything up to the matching ']'.
 */
export class TypeScriptArrayParser {
	constructor(private stream: TokenStream, private source: string) { }

	/**
	 * Parses an array literal, returning a list of tokens
	 * that includes the top-level 'array' token and all
	 * tokens for the array elements (literals, nested objects, etc.).
	 */
	public parseArray(): ParsedItemToken[] {
		if (DEBUG) console.log("TypeScriptArrayParser.parseArray: starting parse");
		const tokens: ParsedItemToken[] = [];

		// 1) Check if next token is '['
		const openBracket = this.stream.peek();
		if (!openBracket || openBracket.name !== '[') {
			// Not an array literal
			if (DEBUG) {
				console.log("TypeScriptArrayParser.parseArray: no '[' found, returning empty");
			}
			return tokens;
		}

		// 2) Create the top-level 'array' token
		const arrToken: ParsedItemToken = {
			type: 'array',
			start: openBracket.start,
			end: openBracket.end, // will update when we find the closing ']'
		};
		tokens.push(arrToken);

		// Consume '['
		this.stream.next();
		let bracketCount = 1;

		// 3) Parse until matching ']'
		while (!this.stream.isEOF() && bracketCount > 0) {
			// Skip any whitespace
			this.stream.consumeWhitespace();
			const current = this.stream.peek();
			if (!current) break;

			// If we find a closing bracket, decrement count and exit
			if (current.name === ']') {
				bracketCount--;
				arrToken.end = current.end; // the array ends here
				if (DEBUG) {
					console.log(
						`TypeScriptArrayParser.parseArray: found closing ']', array ends at ${current.end}, ` +
						`substring: '${this.source.substring(current.start, current.end)}'`
					);
				}
				this.stream.next(); // consume ']'
				break;
			}

			// If we see a comma, just skip it
			if (current.name === ',') {
				if (DEBUG) {
					console.log("TypeScriptArrayParser.parseArray: skipping comma");
				}
				this.stream.next();
				continue;
			}

			// If it's an object literal
			if (current.name === '{') {
				if (DEBUG) {
					console.log("TypeScriptArrayParser.parseArray: detected nested object in array");
				}
				const objParser = new TypeScriptObjectParser(this.stream, this.source);
				const objTokens = objParser.parseObject();
				// We push only the top-level object token from objTokens
				// or all of them, depending on your data structure needs
				tokens.push(...objTokens);
				continue;
			}

			// If it's another array literal
			if (current.name === '[') {
				if (DEBUG) {
					console.log("TypeScriptArrayParser.parseArray: detected nested array in array");
				}
				// Recursively parse a nested array
				const nestedArrayParser = new TypeScriptArrayParser(this.stream, this.source);
				const nestedArrTokens = nestedArrayParser.parseArray();
				tokens.push(...nestedArrTokens);
				continue;
			}

			// If it's a function expression (e.g. `function() {}`)
			// Reuse your existing function-expression parsing logic if desired:
			if (current.type === 'function') {
				if (DEBUG) {
					console.log("TypeScriptArrayParser.parseArray: detected function expression in array");
				}
				// For a simpler approach, we can parse it as a literal,
				// or copy the parseFunctionExpression from TypeScriptObjectParser.
				// Shown here if you want to replicate it:
				const funcToken = this.parseFunctionExpression();
				tokens.push(funcToken);
				continue;
			}

			// Otherwise, treat it as a literal (numbers, identifiers, strings, booleans, etc.)
			const lit = this.stream.next();
			if (lit) {
				const literalToken: ParsedItemToken = {
					type: 'literal',
					start: lit.start,
					end: lit.end,
					name: this.source.substring(lit.start, lit.end),
				};
				tokens.push(literalToken);
				if (DEBUG) {
					console.log(
						`TypeScriptArrayParser.parseArray: parsed literal array item '${literalToken.name}'`
					);
				}
			}
		}

		if (DEBUG) {
			console.log("TypeScriptArrayParser.parseArray: finished parsing array");
		}
		return tokens;
	}

	/**
	 * Example function-expression parser. If you already have this logic
	 * in `TypeScriptObjectParser`, you can reuse that instead.
	 */
	private parseFunctionExpression(): ParsedItemToken {
		const functionKeywordToken = this.stream.next()!;
		const startIndex = functionKeywordToken.start;

		// optional function name
		let functionName = 'anonymous';
		this.stream.consumeWhitespace();
		const maybeNameToken = this.stream.peek();
		if (maybeNameToken && maybeNameToken.type === 'unknown' && maybeNameToken.name !== '(') {
			functionName = maybeNameToken.name ?? 'anonymous';
			this.stream.next(); // consume the name token
		}

		// consume the parameter list: '(' ... ')'
		this.stream.consumeWhitespace();
		let endPos = functionKeywordToken.end;
		const maybeOpenParen = this.stream.peek();
		if (maybeOpenParen && maybeOpenParen.name === '(') {
			endPos = this.parseParenBlock('(', ')');
		}

		// consume the function body: '{' ... '}'
		this.stream.consumeWhitespace();
		const maybeOpenBrace = this.stream.peek();
		if (maybeOpenBrace && maybeOpenBrace.name === '{') {
			endPos = this.parseParenBlock('{', '}');
		}

		return {
			type: 'function',
			name: functionName,
			start: startIndex,
			end: endPos,
		};
	}

	/**
	 * Consumes everything from openSymbol to closeSymbol (including nesting),
	 * returning the end index of the last token consumed.
	 */
	private parseParenBlock(openSymbol: string, closeSymbol: string): number {
		const openToken = this.stream.next()!;
		let depth = 1;
		let endPos = openToken.end;

		while (!this.stream.isEOF() && depth > 0) {
			const t = this.stream.next();
			if (!t) break;
			endPos = t.end;
			if (t.name === openSymbol) {
				depth++;
			} else if (t.name === closeSymbol) {
				depth--;
			}
		}
		return endPos;
	}
}


/******************************************************
 * Interface to represent a parsed type token.
 * The token may be one of:
 *   - a primary type (identifier with optional generics),
 *   - a union type (pipelined using the '|' operator),
 *   - or a parenthesized type.
 ******************************************************/
export interface ParsedTypeToken {
	kind: 'primary' | 'union' | 'parenthesized';
	// For a primary type, name contains the type identifier text.
	name?: string;
	// Start and end positions in the source string.
	start: number;
	end: number;
	// For a union type, subTypes holds all the primary types combined by '|'.
	subTypes?: ParsedTypeToken[];
	// For a primary type, genericArguments holds parsed generic type arguments if any.
	genericArguments?: ParsedTypeToken[];
}

/******************************************************
 * A parser for TypeScript type expressions.
 * It supports union (pipelined) types such as:
 *
 *   A | B | C
 *
 * as well as primary types with optional generic arguments:
 *
 *   Array<string | number>
 *
 * and parenthesized types.
 *
 * This parser uses a SourcePointer, Tokenizer and TokenStream
 * (already defined in the code base) to avoid copying large substrings.
 ******************************************************/
export class TypeScriptTypeParser {
	private stream: TokenStream;

	constructor(private source: string) {
		// Create a source pointer for the input type string.
		const pointer = new SourcePointer(source);
		// Tokenize the input type string.
		const tokenizer = new Tokenizer(pointer);
		const tokens = tokenizer.tokenize();
		// Create a token stream from the tokens.
		this.stream = new TokenStream(tokens);
	}

	/**
	 * Public method to parse the type expression.
	 * Returns a ParsedTypeToken that represents the entire type.
	 */
	public parseType(): ParsedTypeToken {
		// Start parsing the union type expression.
		return this.parseUnionType();
	}

	/**
	 * Parse a union type.
	 * A union type consists of one or more primary types separated by '|'.
	 * For example, given "A | B | C", this method creates a union token
	 * whose subTypes are the tokens for A, B, and C.
	 */
	private parseUnionType(): ParsedTypeToken {
		// Parse the first primary type.
		let left = this.parsePrimaryType();
		const unionTypes: ParsedTypeToken[] = [left];

		// Loop while the next token is a pipe operator '|'.
		while (!this.stream.isEOF() && this.peekPipe()) {
			// Consume the '|' token.
			const pipeToken = this.stream.next()!;
			// (Optionally, you could record the pipe token here.)
			// Consume any whitespace after the pipe.
			this.stream.consumeWhitespace();
			// Parse the next primary type.
			const right = this.parsePrimaryType();
			unionTypes.push(right);
		}

		// If only one type was parsed, return it directly.
		if (unionTypes.length === 1) {
			return left;
		}

		// Return a union type token with the parsed primary types as subTypes.
		return {
			kind: 'union',
			subTypes: unionTypes,
			start: unionTypes[0].start,
			end: unionTypes[unionTypes.length - 1].end
		};
	}

	/**
	 * Parse a primary type.
	 * A primary type may be:
	 *   - an identifier (possibly with generic arguments),
	 *   - or a parenthesized type.
	 */
	private parsePrimaryType(): ParsedTypeToken {
		// Consume any leading whitespace.
		this.stream.consumeWhitespace();
		const token = this.stream.peek();
		if (!token) {
			throw new Error("Unexpected end of input while parsing type expression");
		}

		// If the token is an opening parenthesis, parse a parenthesized type.
		if (token.name === '(') {
			const openParen = this.stream.next()!; // consume '('
			// Parse the inner type expression.
			const innerType = this.parseUnionType();
			this.stream.consumeWhitespace();
			const closeParen = this.stream.peek();
			if (!closeParen || closeParen.name !== ')') {
				throw new Error("Expected ')' in parenthesized type expression");
			}
			this.stream.next(); // consume ')'
			return {
				kind: 'parenthesized',
				subTypes: [innerType],
				start: openParen.start,
				end: closeParen.end
			};
		}

		// For a primary type, consume the token and treat it as an identifier.
		const primaryToken = this.stream.next()!;
		let typeName = this.source.substring(primaryToken.start, primaryToken.end);

		// Create a primary type token.
		const primaryType: ParsedTypeToken = {
			kind: 'primary',
			name: typeName,
			start: primaryToken.start,
			end: primaryToken.end
		};

		// Check if the primary type has generic type arguments (e.g., Array<string>).
		this.stream.consumeWhitespace();
		if (this.stream.peek() && this.stream.peek()!.name === '<') {
			const genericArgs = this.parseGenericArguments();
			primaryType.genericArguments = genericArgs;
			// Update the end position of the primary type to the end of the generic arguments.
			if (genericArgs.length > 0) {
				primaryType.end = genericArgs[genericArgs.length - 1].end;
			}
		}
		return primaryType;
	}

	/**
	 * Parse generic type arguments enclosed in '<' and '>'.
	 * Generic arguments are parsed as a comma-separated list of type expressions.
	 *
	 * For example, given "<string | number, boolean>", this method returns
	 * an array of ParsedTypeToken tokens for each generic argument.
	 */
	private parseGenericArguments(): ParsedTypeToken[] {
		const args: ParsedTypeToken[] = [];
		const ltToken = this.stream.peek();
		if (!ltToken || ltToken.name !== '<') {
			return args;
		}
		// Consume the '<' token.
		this.stream.next();
		this.stream.consumeWhitespace();

		// Parse generic arguments separated by commas.
		while (!this.stream.isEOF()) {
			this.stream.consumeWhitespace();
			// If the next token is '>', then generic arguments are complete.
			const token = this.stream.peek();
			if (token && token.name === '>') {
				this.stream.next(); // consume '>'
				break;
			}
			// Parse a type expression for the generic argument.
			const argType = this.parseUnionType();
			args.push(argType);
			this.stream.consumeWhitespace();
			// If the next token is a comma, consume it and continue parsing.
			const commaToken = this.stream.peek();
			if (commaToken && commaToken.name === ',') {
				this.stream.next(); // consume ','
			}
		}
		return args;
	}

	/**
	 * Helper method to check if the next token is a pipe ('|') operator.
	 */	
	private peekPipe(): boolean {
		const token = this.stream.peek();
		return token !== null && token.name === '|';
	}
}







/******************************************************
 * Builders
 ******************************************************/

/**
 * Represents an edit to be applied to the source text.
 */
interface Edit {
	start: number;
	end: number;
	replacement: string;
}

/**
 * The top-level builder for TypeScript code.
 * It uses the existing parsers (such as TypeScriptBodyParser)
 * to locate code fragments and schedule text edits.
 */
export class TypeScriptCodeBuilder {
	private originalText: string = '';
	private edits: Edit[] = [];
	private parsedTokens: ParsedItemToken[] = [];

	/**
	 * Parses the input TypeScript code.
	 * @param input - The complete TypeScript code as a string.
	 */
	public parseText(input: string): void {
		this.originalText = input;
		this.edits = [];
		const parser = new TypeScriptBodyParser(input);
		this.parsedTokens = parser.parseBody();
	}

	/**
	 * Finds an object literal associated with a given variable name.
	 * For example, if the code has a variable declaration like:
	 *   const location = { ... };
	 * then findObject('location', …) will locate the object literal initializer.
	 * @param objectName - The variable name whose object literal to locate.
	 * @param options - Callbacks executed when the object is found or not found.
	 */
	public findObject(
		objectName: string,
		options: { onFound: (objectBuilder: ObjectBuilder) => void; onNotFound?: () => void }
	): void {
		let targetObjectToken: ParsedItemToken | undefined;
		// Search for a variable token with the given name, then find its object initializer.
		for (let i = 0; i < this.parsedTokens.length; i++) {
			const token = this.parsedTokens[i];
			if (token.type === 'variable' && token.name === objectName) {
				// Look for the next object token (assumed to be the initializer) after the variable token.
				for (let j = i + 1; j < this.parsedTokens.length; j++) {
					const nextToken = this.parsedTokens[j];
					if (nextToken.type === 'object' && nextToken.start >= token.end) {
						targetObjectToken = nextToken;
						break;
					}
				}
			}
			if (targetObjectToken) {
				break;
			}
		}
		if (targetObjectToken) {
			const objectBuilder = new ObjectBuilder(
				this,
				targetObjectToken.start,
				targetObjectToken.end,
				this.originalText
			);
			options.onFound(objectBuilder);
		} else if (options.onNotFound) {
			options.onNotFound();
		}
	}

	/**
	 * Schedules an edit (text replacement) in the source code.
	 * @param start - The starting index of the text to replace.
	 * @param end - The ending index of the text to replace.
	 * @param replacement - The new text to insert.
	 */
	public addEdit(start: number, end: number, replacement: string): void {
		this.edits.push({ start, end, replacement });
	}

	/**
	 * Applies all scheduled edits to the original code and returns the modified code.
	 * Edits are applied in descending order so that earlier edits do not shift later indices.
	 * @returns A promise resolving to the modified source code.
	 */
	public async toString(): Promise<string> {
		// Sort the edits by starting index in descending order.
		const sortedEdits = this.edits.sort((a, b) => b.start - a.start);
		let modified = this.originalText;
		for (const edit of sortedEdits) {
			modified = modified.slice(0, edit.start) + edit.replacement + modified.slice(edit.end);
		}
		return modified;
	}

	/**
	 * Finds a type annotation for a given variable name.
	 * For example, if the code has a variable declaration like:
	 *   const x: number = 123;
	 * then findType('x', …) will locate the type annotation "number".
	 * @param variableName - The variable name whose type annotation to locate.
	 * @param options - Callbacks executed when the type is found or not found.
	 */
	public findType(
		variableName: string,
		options: { onFound: (typeBuilder: TypeScriptTypeBuilder) => void; onNotFound?: () => void }
	): void {
		let targetVariableToken: ParsedItemToken | undefined;
		// Search for a variable token with the given name.
		for (let i = 0; i < this.parsedTokens.length; i++) {
			const token = this.parsedTokens[i];
			if (token.type === 'variable' && token.name === variableName) {
				targetVariableToken = token;
				break;
			}
		}
		if (targetVariableToken) {
			// Look for the colon ':' that indicates the start of the type annotation.
			const colonIndex = this.originalText.indexOf(':', targetVariableToken.end);
			if (colonIndex !== -1) {
				// Set the start of the type region immediately after the colon.
				let typeStart = colonIndex + 1;
				// Determine the end of the type annotation.
				// We assume the type ends at the first '=' or ';' after the type start.
				let typeEndCandidates: number[] = [];
				const eqIndex = this.originalText.indexOf('=', typeStart);
				if (eqIndex !== -1) {
					typeEndCandidates.push(eqIndex);
				}
				const semicolonIndex = this.originalText.indexOf(';', typeStart);
				if (semicolonIndex !== -1) {
					typeEndCandidates.push(semicolonIndex);
				}
				// If no delimiter is found, use the end of the source text.
				if (typeEndCandidates.length === 0) {
					typeEndCandidates.push(this.originalText.length);
				}
				const typeEnd = Math.min(...typeEndCandidates);
				// Create a new TypeScriptTypeBuilder for the located type annotation.
				const typeBuilder = new TypeScriptTypeBuilder(this, typeStart, typeEnd, this.originalText);
				options.onFound(typeBuilder);
			} else if (options.onNotFound) {
				options.onNotFound();
			}
		} else if (options.onNotFound) {
			options.onNotFound();
		}
	}
}

/**
 * Builder for object literals.
 * Provides methods to modify property values and to find nested array literals.
 */
export class ObjectBuilder {
	/**
	 * @param parentBuilder - A reference to the top-level code builder.
	 * @param objStart - The starting index (in the original text) of the object literal.
	 * @param objEnd - The ending index (in the original text) of the object literal.
	 * @param originalText - The complete original source code.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		private objStart: number,
		private objEnd: number,
		private originalText: string
	) { }

	/**
	 * Replaces the value of a property in the object literal.
	 * This method parses the object literal (using the TypeScriptObjectParser)
	 * to locate the property token and its value. Then it schedules an edit
	 * to replace the text of the property value.
	 * @param propertyName - The name of the property to modify.
	 * @param newValue - The new value as a string (for example, "'new-village'").
	 */
	public setPropertyValue(propertyName: string, newValue: string): void {
		// Extract the object literal text from the full source.
		const objectText = this.originalText.substring(this.objStart, this.objEnd);
		// Create a new parser for the object literal.
		const pointer = new SourcePointer(objectText);
		const tokenizer = new Tokenizer(pointer);
		const tokens = tokenizer.tokenize();
		const stream = new TokenStream(tokens);
		const objParser = new TypeScriptObjectParser(stream, objectText);
		const parsedTokens = objParser.parseObject();

		// Iterate through the tokens to find the property with the given name.
		for (let i = 0; i < parsedTokens.length; i++) {
			const token = parsedTokens[i];
			if (token.type === 'property' && token.name === propertyName) {
				// Assume the next token is the value token.
				if (i + 1 < parsedTokens.length) {
					const valueToken = parsedTokens[i + 1];
					// Calculate absolute positions relative to the full source.
					const absoluteStart = this.objStart + valueToken.start;
					const absoluteEnd = this.objStart + valueToken.end;
					// Schedule the replacement of the value.
					this.parentBuilder.addEdit(absoluteStart, absoluteEnd, newValue);
				}
				break;
			}
		}
	}

	/**
	 * Finds an array literal property within the object literal and calls the callback.
	 * @param propertyName - The property name whose value is expected to be an array.
	 * @param options - Callbacks executed when the array is found or not found.
	 */
	public findArray(
		propertyName: string,
		options: { onFound: (arrayBuilder: ArrayBuilder) => void; onNotFound?: () => void }
	): void {
		const objectText = this.originalText.substring(this.objStart, this.objEnd);
		const pointer = new SourcePointer(objectText);
		const tokenizer = new Tokenizer(pointer);
		const tokens = tokenizer.tokenize();
		const stream = new TokenStream(tokens);
		const objParser = new TypeScriptObjectParser(stream, objectText);
		const parsedTokens = objParser.parseObject();

		// Look for the property token and then for an array token among its following tokens.
		for (let i = 0; i < parsedTokens.length; i++) {
			const token = parsedTokens[i];
			if (token.type === 'property' && token.name === propertyName) {
				for (let j = i + 1; j < parsedTokens.length; j++) {
					const nextToken = parsedTokens[j];
					if (nextToken.type === 'array') {
						const absoluteStart = this.objStart + nextToken.start;
						const absoluteEnd = this.objStart + nextToken.end;
						const arrayBuilder = new ArrayBuilder(this.parentBuilder, absoluteStart, absoluteEnd, this.originalText);
						options.onFound(arrayBuilder);
						return;
					}
				}
			}
		}
		if (options.onNotFound) {
			options.onNotFound();
		}
	}
}

/**
 * Builder for array literals.
 * Provides methods to work with array elements.
 */
export class ArrayBuilder {
	/**
	 * @param parentBuilder - A reference to the top-level code builder.
	 * @param arrStart - The starting index (in the original text) of the array literal.
	 * @param arrEnd - The ending index (in the original text) of the array literal.
	 * @param originalText - The complete original source code.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		private arrStart: number,
		private arrEnd: number,
		private originalText: string
	) { }

	/**
	 * Retrieves the object builders for each object element within the array literal.
	 * It re-parses the array literal using the TypeScriptArrayParser and then
	 * creates an ObjectBuilder for each nested object literal.
	 * @returns An array of ObjectBuilder instances.
	 */
	public getItems(): ObjectBuilder[] {
		const arrayText = this.originalText.substring(this.arrStart, this.arrEnd);
		const pointer = new SourcePointer(arrayText);
		const tokenizer = new Tokenizer(pointer);
		const tokens = tokenizer.tokenize();
		const stream = new TokenStream(tokens);
		const arrayParser = new TypeScriptArrayParser(stream, arrayText);
		const parsedTokens = arrayParser.parseArray();

		const objectBuilders: ObjectBuilder[] = [];
		// Iterate through tokens and create an ObjectBuilder for each object literal.
		for (const token of parsedTokens) {
			if (token.type === 'object') {
				const absoluteStart = this.arrStart + token.start;
				const absoluteEnd = this.arrStart + token.end;
				objectBuilders.push(new ObjectBuilder(this.parentBuilder, absoluteStart, absoluteEnd, this.originalText));
			}
		}
		return objectBuilders;
	}
}


/******************************************************
 * TypeScriptTypeBuilder
 * 
 * A builder to modify TypeScript type expressions in the source code.
 * It uses the TypeScriptTypeParser to parse a type expression and
 * provides methods to list union types and add a new type to the union.
 ******************************************************/
export class TypeScriptTypeBuilder {
	// The parsed type (as a ParsedTypeToken) representing the type expression.
	private parsedType: ParsedTypeToken;
	// The current type expression text (extracted from the original source).
	private typeText: string;

	/**
	 * @param parentBuilder - A reference to the top-level code builder.
	 * @param typeStart - The starting index (in the original text) of the type expression.
	 * @param typeEnd - The ending index (in the original text) of the type expression.
	 * @param originalText - The complete original source code.
	 */
	constructor(
		private parentBuilder: TypeScriptCodeBuilder,
		private typeStart: number,
		private typeEnd: number,
		private originalText: string
	) {
		// Extract the type expression text from the original source.
		this.typeText = this.originalText.substring(this.typeStart, this.typeEnd);
		// Parse the type expression.
		const parser = new TypeScriptTypeParser(this.typeText);
		this.parsedType = parser.parseType();
	}

	/**
	 * Returns an array of string representations of the types in the union.
	 * If the type is not a union, returns an array with a single element.
	 */
	public getUnionTypes(): string[] {
		if (this.parsedType.kind === 'union' && this.parsedType.subTypes) {
			// Map each subtype's relative positions to the typeText.
			return this.parsedType.subTypes.map((subType) =>
				this.typeText.substring(subType.start, subType.end).trim()
			);
		}
		return [this.typeText.trim()];
	}

	/**
	 * Appends a new type to the union.
	 * If the current type is not a union, it converts it into a union with the new type.
	 * Schedules an edit in the parent builder.
	 * @param newType - The new type to add to the union.
	 */
	public addUnionType(newType: string): void {
		// Normalize the current type text and add a single space before and after the new union.
		const normalizedCurrent = this.typeText.trim();
		const normalizedNew = newType.trim();
		const updatedTypeText = " " + normalizedCurrent + " | " + normalizedNew + " ";

		// Schedule the replacement in the source text.
		this.parentBuilder.addEdit(this.typeStart, this.typeEnd, updatedTypeText);

		// Update the internal state.
		this.typeText = updatedTypeText;
		const parser = new TypeScriptTypeParser(this.typeText);
		this.parsedType = parser.parseType();
	}

	/**
	 * Replaces the entire type expression with a new type.
	 * Schedules an edit in the parent builder.
	 * @param newType - The new type expression to set.
	 */
	public setType(newType: string): void {
		const normalizedNew = " " + newType.trim() + " ";
		this.parentBuilder.addEdit(this.typeStart, this.typeEnd, normalizedNew);
		this.typeText = normalizedNew;
		const parser = new TypeScriptTypeParser(this.typeText);
		this.parsedType = parser.parseType();
	}

	/**
	 * Retrieves the current type expression text.
	 */
	public getTypeText(): string {
		return this.typeText.trim();
	}
}
