import * as assert from 'assert';
import * as vscode from 'vscode';
import { ParsedTypeToken, SourcePointer, Tokenizer, TokenStream, TypeScriptArrayParser, TypeScriptBodyParser, TypeScriptCodeBuilder, TypeScriptObjectParser, TypeScriptTypeBuilder, TypeScriptTypeParser, TypeScriptVariableParser } from '../typescriptObjectParser/ObjectParser';










suite('Parsers', () => {

	suite('TypeScriptBodyParser', () => {

		test('Should parse a single class', async () => {
			const input = `class MyClass {}`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 1 item: a class
			assert.strictEqual(result.length, 1, 'There should be exactly one parsed item');
			assert.strictEqual(result[0].type, 'class', 'The parsed item should be a class');
			assert.strictEqual(result[0].name, 'MyClass', 'The class name should be "MyClass"');
		});

		test('Should parse interface and type declarations', async () => {
			const input = `
	  interface MyInterface {}
	  type MyType = number;
	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 2 items: an interface and a type
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].type, 'interface', 'First item should be interface');
			assert.strictEqual(result[0].name, 'MyInterface');
			assert.strictEqual(result[1].type, 'type', 'Second item should be type');
			assert.strictEqual(result[1].name, 'MyType');
		});

		test('Should parse an enum', async () => {
			const input = `enum Colors { Red, Green, Blue }`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 1 item: an enum
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].type, 'enum');
			assert.strictEqual(result[0].name, 'Colors');
		});

		test('Should parse multiple variable declarations', async () => {
			const input = `
	  const x = 10;
	  let y = "hello";
	  var z = true;
	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 3 items (all are 'variable')
			assert.strictEqual(result.length, 3);
			assert.strictEqual(result[0].type, 'variable');
			assert.strictEqual(result[1].type, 'variable');
			assert.strictEqual(result[2].type, 'variable');
		});

		test('Should parse a function', async () => {
			const input = `function greet() { return "Hello"; }`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 1 item: a function
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].type, 'function');
			assert.strictEqual(result[0].name, 'greet');
		});

		test('Should parse class with generic parameters', async () => {
			const input = `
	  class GenericClass<T, U> {
		method(arg: T): U {
		  return {} as U;
		}
	  }
	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 1 item: a class
			assert.strictEqual(result.length, 1);
			assert.strictEqual(result[0].type, 'class');
			assert.strictEqual(result[0].name, 'GenericClass');
			assert.ok(result[0].templateParams && result[0].templateParams.includes('<T, U>'));
		});

		test('Should skip unknown tokens gracefully', async () => {
			const input = `
	  #!someUnknownDirective
	  class KnownClass {}
	  ?? random stuff ??
	  interface KnownInterface {}
	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 2 recognized items: class and interface
			assert.strictEqual(result.length, 2, 'We should have 2 recognized items');
			assert.strictEqual(result[0].type, 'class');
			assert.strictEqual(result[0].name, 'KnownClass');
			assert.strictEqual(result[1].type, 'interface');
			assert.strictEqual(result[1].name, 'KnownInterface');
		});

		test('Should handle missing closing brace in class', async () => {
			const input = `
class NotClosed {
}
let x = 10

	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 2 items: a class and a variable
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].type, 'class');
			assert.strictEqual(result[0].name, 'NotClosed');
			assert.strictEqual(result[1].type, 'variable');
			assert.strictEqual(result[1].name, 'x');
		});

		test('Should parse multiple top-level constructs', async () => {
			const input = `
	  class A {}
	  interface B {}
	  type C = string;
	  enum D { X, Y }
	  function e() {}
	  const f = 123;
	`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect 6 recognized items
			assert.strictEqual(result.length, 6);
			assert.strictEqual(result[0].type, 'class');
			assert.strictEqual(result[0].name, 'A');
			assert.strictEqual(result[1].type, 'interface');
			assert.strictEqual(result[1].name, 'B');
			assert.strictEqual(result[2].type, 'type');
			assert.strictEqual(result[2].name, 'C');
			assert.strictEqual(result[3].type, 'enum');
			assert.strictEqual(result[3].name, 'D');
			assert.strictEqual(result[4].type, 'function');
			assert.strictEqual(result[4].name, 'e');
			assert.strictEqual(result[5].type, 'variable');
			assert.strictEqual(result[5].name, 'f');
		});

	});

	suite('TypeScriptBodyParser - Array Literal Parsing', () => {

		test('Should parse a top-level array literal as an array token', () => {
			// The input is a complete array literal containing mixed element types.
			const input = `[ 1, 2, { a: b }, [ 3, 4 ], function() {} ]`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect one top-level token representing the array literal.
			assert.strictEqual(result.length, 1, 'Expected one top-level token for the array literal');

			const arrayToken = result[0];
			// Check that the token type is "array".
			assert.strictEqual(arrayToken.type, 'array', 'Expected token type to be "array"');
			// Check that the token starts at index 0.
			assert.strictEqual(arrayToken.start, 0, 'Expected array token to start at index 0');
			// Check that the token spans the entire input.
			assert.strictEqual(arrayToken.end, input.length, 'Expected array token to span entire input');
		});

		test('Should parse a variable declaration with an array initializer and return both tokens', () => {
			// In this input, a variable declaration uses an array literal as its initializer.
			const input = `const arr = [ 1, 2, 3 ];`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect two tokens:
			// 1. The variable token for "arr"
			// 2. The array token covering the array literal initializer.
			assert.strictEqual(result.length, 2, 'Expected two tokens: one variable and one array literal');

			const variableToken = result[0];
			// Verify the variable token type and name.
			assert.strictEqual(variableToken.type, 'variable', 'Expected first token to be a variable');
			assert.strictEqual(variableToken.name, 'arr', 'Expected variable name to be "arr"');

			const arrayToken = result[1];
			// Verify the array token type.
			assert.strictEqual(arrayToken.type, 'array', 'Expected second token to be an array literal');

			// The start index of the array token should be the position of the first '['.
			const expectedStart = input.indexOf('[');
			// The end index should be one plus the position of the last ']' character.
			const expectedEnd = input.lastIndexOf(']') + 1;
			assert.strictEqual(arrayToken.start, expectedStart, 'Array token start should match the position of "["');
			assert.strictEqual(arrayToken.end, expectedEnd, 'Array token end should match the position after "]"');
		});

		test('Should correctly parse an array literal with mixed element types', () => {
			// The input array contains a string literal, a number literal, an object literal, and a nested array.
			const input = `[ 'text', 42, { key: value }, [ true, false ] ]`;
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect one top-level token representing the array literal.
			assert.strictEqual(result.length, 1, 'Expected one top-level token for the array literal');

			const arrayToken = result[0];
			assert.strictEqual(arrayToken.type, 'array', 'Expected token type "array"');
			assert.strictEqual(arrayToken.start, 0, 'Expected array token to start at index 0');
			assert.strictEqual(arrayToken.end, input.length, 'Expected array token to span entire input');
		});

		test('Should parse an empty array literal', () => {
			const input = 'const empty = [];';
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect one variable token and one array token.
			assert.strictEqual(result.length, 2, 'Expected two tokens: one variable and one array literal');

			const variableToken = result.find(token => token.type === 'variable');
			assert.ok(variableToken, 'Expected a variable token');
			assert.strictEqual(variableToken.name, 'empty', 'Expected variable name to be "empty"');
		});

		test('Should parse an empty array literal with whitespace', () => {
			const input = '[  ]';
			const parser = new TypeScriptBodyParser(input);
			const result = parser.parseBody();

			// We expect one top-level token representing the array literal.
			assert.strictEqual(result.length, 1, 'Expected one top-level token for the array literal');

			const arrayToken = result[0];
			assert.strictEqual(arrayToken.type, 'array', 'Expected token type "array"');
			assert.strictEqual(arrayToken.start, 0, 'Expected array token to start at index 0');
			assert.strictEqual(arrayToken.end, input.length, 'Expected array token to span entire input');
		});
	});


	suite('TypeScriptObjectParser', () => {

		test('Should parse an empty object literal', async () => {
			const input = '{}';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expect one token: the object token spanning the whole input.
			assert.strictEqual(result.length, 1, 'Expected one object token for an empty object');
			assert.strictEqual(result[0].type, 'object', 'Token type should be object');
			assert.strictEqual(result[0].start, 0, 'Object token should start at index 0');
			assert.strictEqual(result[0].end, input.length, 'Object token should end at the input length');
		});

		test('Should parse object with a single property with literal value', async () => {
			// Using identifier literals (e.g. "abc") so that the tokenizer does not split numbers.
			const input = '{ key: abc }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// 0: overall object token
			// 1: property token for "key"
			// 2: literal token for the value "abc"
			assert.strictEqual(result.length, 3, 'Expected 3 tokens for an object with one property');
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'key');
			assert.strictEqual(result[2].type, 'literal');
			assert.strictEqual(result[2].name, 'abc');
		});

		test('Should parse object with multiple properties', async () => {
			const input = '{ a: one, b: two }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// 0: object token
			// 1: property token for "a"
			// 2: literal token for "one"
			// 3: property token for "b"
			// 4: literal token for "two"
			assert.strictEqual(result.length, 5, 'Expected 5 tokens for an object with two properties');
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'a');
			assert.strictEqual(result[2].type, 'literal');
			assert.strictEqual(result[2].name, 'one');
			assert.strictEqual(result[3].type, 'property');
			assert.strictEqual(result[3].name, 'b');
			assert.strictEqual(result[4].type, 'literal');
			assert.strictEqual(result[4].name, 'two');
		});

		test('Should parse nested object literal', async () => {
			const input = '{ outer: { inner: innerVal } }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// 0: outer object token (the whole outer object)
			// 1: property token for "outer"
			// 2: inner object token (nested object)
			// 3: property token for "inner"
			// 4: literal token for "innerVal"
			assert.strictEqual(result.length, 5, 'Expected 5 tokens for nested object structure');
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'outer');
			assert.strictEqual(result[2].type, 'object');
			assert.strictEqual(result[3].type, 'property');
			assert.strictEqual(result[3].name, 'inner');
			assert.strictEqual(result[4].type, 'literal');
			assert.strictEqual(result[4].name, 'innerVal');
		});

		test('Should parse object with array literal property', async () => {
			const input = '{ list: [ one, two, three ] }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// 0: object token for the whole object
			// 1: property token for "list"
			// 2: array token for the array literal
			// then literal tokens for each array element ("one", "two", "three")
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'list');
			const arrayToken = result.find(t => t.type === 'array');
			assert.ok(arrayToken, 'Expected an array token for the property value');
			// Find literal tokens for array elements.
			const literalTokens = result.filter(t => t.type === 'literal');
			const literalValues = literalTokens.map(t => t.name);
			assert.deepStrictEqual(literalValues, ['one', 'two', 'three'], 'Expected literal tokens for array elements');
		});

		test('Should handle shorthand property without colon', async () => {
			const input = '{ shorthand }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens: an object token and a property token with name "shorthand".
			assert.strictEqual(result.length, 2, 'Expected 2 tokens for shorthand property');
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'shorthand');
		});

		test('Should return empty tokens if not starting with an object literal', async () => {
			const input = 'not an object';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Since the first token is not '{', we expect an empty array.
			assert.strictEqual(result.length, 0, 'Expected no tokens when not starting with "{"');
		});

		test('Should parse function as property value', async () => {
			const input = '{ action: function() { return abc; } }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// 0: object token
			// 1: property token for "action"
			// 2: function token for the function value (with name 'anonymous')
			assert.strictEqual(result[0].type, 'object');
			assert.strictEqual(result[1].type, 'property');
			assert.strictEqual(result[1].name, 'action');
			const functionToken = result.find(t => t.type === 'function');
			assert.ok(functionToken, 'Expected a function token for the function property value');
			assert.strictEqual(functionToken.name, 'anonymous');
		});

	});



	suite('TypeScriptObjectParser - Array Literal in Object', () => {

		test('Should parse object with an array literal property', () => {
			// The input is an object with a property "arr" whose value is an array literal.
			const input = '{ arr: [ 1, 2, 3 ] }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Expected tokens:
			// - Token 0: overall object token.
			// - Token 1: property token for "arr".
			// - Somewhere in the list, an array token representing [ 1, 2, 3 ].
			const propertyToken = result.find(token => token.type === 'property' && token.name === 'arr');
			assert.ok(propertyToken, 'Expected a property token with name "arr"');

			const arrayToken = result.find(token => token.type === 'array');
			assert.ok(arrayToken, 'Expected an array token for the property "arr" value');

			// Verify that the array token boundaries match the positions of '[' and ']' in the input.
			const expectedStart = input.indexOf('[');
			const expectedEnd = input.lastIndexOf(']') + 1;
			assert.strictEqual(arrayToken.start, expectedStart, 'Array token should start at the first "[" of the array literal');
			assert.strictEqual(arrayToken.end, expectedEnd, 'Array token should end after the last "]" of the array literal');
		});

		test('Should parse nested array literal in an object property', () => {
			// The input is an object with a property "matrix" that holds a nested array.
			const input = '{ matrix: [ [ 1, 2 ], [ 3, 4 ] ] }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Verify that the property token for "matrix" exists.
			const propertyToken = result.find(token => token.type === 'property' && token.name === 'matrix');
			assert.ok(propertyToken, 'Expected a property token with name "matrix"');

			// The outer array token for the value of "matrix" should be present.
			const outerArrayToken = result.find(token => token.type === 'array');
			assert.ok(outerArrayToken, 'Expected an outer array token for the value of "matrix"');

			// Since the outer array contains nested arrays, we expect to see two array tokens:
			// one for the outer array and one for one of the nested arrays.
			const arrayTokens = result.filter(token => token.type === 'array');
			assert.strictEqual(arrayTokens.length, 2, 'Expected two array tokens: one for the outer array and one for a nested array');

			// Check that the nested array token starts at a position greater than the outer array token.
			const nestedArrayToken = arrayTokens.find(token => token.start !== outerArrayToken.start);
			assert.ok(nestedArrayToken, 'Expected a nested array token for the inner array');
		});

		test('Should parse object with an array literal property containing objects', () => {
			// The input is an object whose property "list" is an array containing two object literals.
			const input = '{ list: [ { a: b }, { c: d } ] }';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const objParser = new TypeScriptObjectParser(stream, input);
			const result = objParser.parseObject();

			// Verify that the property token for "list" exists.
			const propertyToken = result.find(token => token.type === 'property' && token.name === 'list');
			assert.ok(propertyToken, 'Expected a property token with name "list"');

			// Verify that an array token exists for the value of "list".
			const arrayToken = result.find(token => token.type === 'array');
			assert.ok(arrayToken, 'Expected an array token for the "list" property value');

			// Within that array, the parser should have detected object tokens.
			// (Depending on your implementation, it may only push the top-level object token for each object literal.)
			const objectTokensInArray = result.filter(token =>
				token.type === 'object' && token.start > arrayToken.start
			);
			assert.strictEqual(objectTokensInArray.length, 2, 'Expected two object tokens for the objects inside the array literal');
		});

	});




	suite('TypeScriptVariableParser', () => {

		test('Should parse variable with literal initializer', async () => {
			const input = 'const x = 123;';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const varParser = new TypeScriptVariableParser(input, tokens);
			const result = varParser.parseVariable();

			// Expect the keyword to be "const", the variable name "x", and the initializer to be a literal "123"
			assert.strictEqual(result.variableKeyword, 'const', 'Variable keyword should be "const"');
			assert.strictEqual(result.variableName, 'x', 'Variable name should be "x"');
			assert.ok(result.initializer, 'Initializer should be present');
			assert.strictEqual(result.initializer?.type, 'literal', 'Initializer type should be literal');
			assert.strictEqual(result.initializer?.name, '123', 'Initializer value should be "123"');
		});

		test('Should parse variable with object initializer', async () => {
			const input = 'let obj = { a: b };';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const varParser = new TypeScriptVariableParser(input, tokens);
			const result = varParser.parseVariable();

			// Expect the keyword to be "let", the variable name "obj",
			// and the initializer to be an object literal spanning from '{' to '}'
			assert.strictEqual(result.variableKeyword, 'let', 'Variable keyword should be "let"');
			assert.strictEqual(result.variableName, 'obj', 'Variable name should be "obj"');
			assert.ok(result.initializer, 'Initializer should be present');
			assert.strictEqual(result.initializer?.type, 'object', 'Initializer should be an object token');

			// Optionally verify that the initializer text matches the object literal
			const initText = input.substring(result.initializer!.start, result.initializer!.end);
			assert.strictEqual(initText.trim(), '{ a: b }', 'Initializer object text should match');
		});

		test('Should parse variable with array initializer', async () => {
			const input = 'var arr = [ one, two, three ];';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const varParser = new TypeScriptVariableParser(input, tokens);
			const result = varParser.parseVariable();

			// Expect the keyword "var", variable name "arr",
			// and an initializer that is an array token.
			assert.strictEqual(result.variableKeyword, 'var', 'Variable keyword should be "var"');
			assert.strictEqual(result.variableName, 'arr', 'Variable name should be "arr"');
			assert.ok(result.initializer, 'Initializer should be present');
			assert.strictEqual(result.initializer?.type, 'array', 'Initializer should be an array token');

			const initText = input.substring(result.initializer!.start, result.initializer!.end);
			assert.strictEqual(initText.trim(), '[ one, two, three ]', 'Initializer array text should match');
		});

		test('Should parse variable without initializer', async () => {
			const input = 'let y;';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const varParser = new TypeScriptVariableParser(input, tokens);
			const result = varParser.parseVariable();

			// Expect the keyword "let" and variable name "y" with no initializer.
			assert.strictEqual(result.variableKeyword, 'let', 'Variable keyword should be "let"');
			assert.strictEqual(result.variableName, 'y', 'Variable name should be "y"');
			assert.strictEqual(result.initializer, undefined, 'Initializer should be undefined when not provided');
		});

		test('Should handle extra whitespace in variable declaration', async () => {
			const input = "  const   z   =   'hello'  ; ";
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const varParser = new TypeScriptVariableParser(input, tokens);
			const result = varParser.parseVariable();

			// Expect the keyword "const", variable name "z",
			// and a literal initializer with the value "'hello'"
			assert.strictEqual(result.variableKeyword, 'const', 'Variable keyword should be "const"');
			assert.strictEqual(result.variableName, 'z', 'Variable name should be "z"');
			assert.ok(result.initializer, 'Initializer should be present');
			assert.strictEqual(result.initializer?.type, 'literal', 'Initializer should be a literal token');
			assert.strictEqual(result.initializer?.name, "'hello'", 'Initializer value should be \'hello\'');
		});

	});


	suite('TypeScriptArrayParser', () => {

		test('Should parse an empty array literal', () => {
			const input = '[]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expect one token: the top-level array token covering the entire input.
			assert.strictEqual(result.length, 1, 'Expected one token for an empty array literal');
			assert.strictEqual(result[0].type, 'array', 'The token type should be "array"');
			assert.strictEqual(result[0].start, 0, 'The array token should start at index 0');
			assert.strictEqual(result[0].end, input.length, 'The array token should end at the input length');
		});

		test('Should parse an array literal with literal values', () => {
			const input = '[ 1, 2, 3 ]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expected tokens:
			// - One token for the outer array literal.
			// - Three literal tokens for the numbers "1", "2", and "3".
			// Total expected tokens = 4.
			assert.strictEqual(result.length, 4, 'Expected 4 tokens: one array token and three literal tokens');
			assert.strictEqual(result[0].type, 'array', 'The first token should be an array token');

			// Collect literal tokens (the tokens after the top-level array token)
			const literalTokens = result.slice(1);
			const literalValues = literalTokens.map(token => token.name);
			assert.deepStrictEqual(literalValues, ['1', '2', '3'], 'Expected literal values "1", "2", and "3"');
		});

		test('Should parse an array literal with a nested array', () => {
			const input = '[ 1, [ 2, 3 ], 4 ]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expected tokens:
			// - Outer array token.
			// - Literal token for "1".
			// - Tokens from the nested array: a nested array token and its literal tokens ("2" and "3").
			// - Literal token for "4".
			// Total expected tokens = 1 (outer array) + 1 ("1") + 3 (nested array) + 1 ("4") = 6 tokens.
			assert.strictEqual(result.length, 6, 'Expected 6 tokens for an array with a nested array');

			// Verify that the nested array token exists (its start should be different from the outer array token)
			const nestedArrayToken = result.find(token => token.type === 'array' && token.start !== result[0].start);
			assert.ok(nestedArrayToken, 'Expected a nested array token');

			// Check that the nested array includes the literal tokens "2" and "3"
			const literalNames = result.filter(token => token.type === 'literal').map(token => token.name);
			assert.ok(literalNames.includes('2'), 'Expected literal "2" in the nested array');
			assert.ok(literalNames.includes('3'), 'Expected literal "3" in the nested array');
		});

		test('Should parse an array literal with a nested object', () => {
			const input = '[ { a: b } ]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expected tokens:
			// - Top-level array token.
			// - Tokens returned by the object parser (which should include an object token).
			assert.ok(result.length > 1, 'Expected more than one token for an array with an object literal');
			const objectToken = result.find(token => token.type === 'object');
			assert.ok(objectToken, 'Expected an object token within the array literal');
		});

		test('Should parse an array literal with a function expression', () => {
			const input = '[ function() { return 1; } ]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expected tokens:
			// - Top-level array token.
			// - Function token for the function expression.
			const functionToken = result.find(token => token.type === 'function');
			assert.ok(functionToken, 'Expected a function token within the array literal');
			assert.strictEqual(functionToken.name, 'anonymous', 'Function token should have the name "anonymous"');
		});

		test('Should parse an array literal with mixed element types', () => {
			const input = '[ 1, { a: b }, [ 2, 3 ], function() {} ]';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Expected tokens include:
			// - Outer array token.
			// - Literal token for "1".
			// - Tokens for the nested object.
			// - Tokens for the nested array.
			// - Function token for the function expression.
			assert.ok(result.length > 0, 'Expected tokens from an array with mixed elements');

			// Check for literal "1"
			const literalOne = result.find(token => token.type === 'literal' && token.name === '1');
			assert.ok(literalOne, 'Expected a literal token "1"');

			// Check for nested object token
			const objectToken = result.find(token => token.type === 'object');
			assert.ok(objectToken, 'Expected an object token for the nested object');

			// Check for nested array token (not the outer array token)
			const nestedArrayToken = result.find(token => token.type === 'array' && token.start !== result[0].start);
			assert.ok(nestedArrayToken, 'Expected a nested array token for the inner array');

			// Check for function token
			const functionToken = result.find(token => token.type === 'function');
			assert.ok(functionToken, 'Expected a function token for the function expression');
		});

		test('Should return empty tokens when input is not an array literal', () => {
			const input = 'not an array';
			const pointer = new SourcePointer(input);
			const tokenizer = new Tokenizer(pointer);
			const tokens = tokenizer.tokenize();
			const stream = new TokenStream(tokens);
			const arrayParser = new TypeScriptArrayParser(stream, input);
			const result = arrayParser.parseArray();

			// Since the input does not start with '[', we expect no tokens to be returned.
			assert.strictEqual(result.length, 0, 'Expected no tokens when input is not an array literal');
		});

	});



	suite('TypeScriptTypeParser', () => {

		test('should parse a simple primary type', () => {
			const input = 'number';
			const parser = new TypeScriptTypeParser(input);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a primary type token with name "number"
			assert.strictEqual(result.kind, 'primary', 'Expected token kind to be "primary"');
			assert.strictEqual(result.name, 'number', 'Expected type name to be "number"');
			assert.strictEqual(result.start, 0, 'Expected start index to be 0');
			assert.strictEqual(result.end, input.length, 'Expected end index to be the input length');
		});

		test('should parse a union type', () => {
			const input = 'A | B | C';
			const parser = new TypeScriptTypeParser(input);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a union type token with three primary subtypes: "A", "B", "C"
			assert.strictEqual(result.kind, 'union', 'Expected token kind to be "union"');
			assert.ok(result.subTypes, 'Expected union token to have subTypes');
			assert.strictEqual(result.subTypes!.length, 3, 'Expected three subtypes in the union');

			assert.strictEqual(result.subTypes![0].kind, 'primary', 'Expected first subtype to be primary');
			assert.strictEqual(result.subTypes![0].name, 'A', 'Expected first subtype name to be "A"');
			assert.strictEqual(result.subTypes![1].kind, 'primary', 'Expected second subtype to be primary');
			assert.strictEqual(result.subTypes![1].name, 'B', 'Expected second subtype name to be "B"');
			assert.strictEqual(result.subTypes![2].kind, 'primary', 'Expected third subtype to be primary');
			assert.strictEqual(result.subTypes![2].name, 'C', 'Expected third subtype name to be "C"');
		});

		test('should parse a generic type', () => {
			const input = 'Array<string>';
			const parser = new TypeScriptTypeParser(input);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a primary type token with generic arguments
			assert.strictEqual(result.kind, 'primary', 'Expected token kind to be "primary"');
			assert.strictEqual(result.name, 'Array', 'Expected type name to be "Array"');
			assert.ok(result.genericArguments, 'Expected generic arguments to be present');
			assert.strictEqual(result.genericArguments!.length, 1, 'Expected one generic argument');

			const genericArg = result.genericArguments![0];
			assert.strictEqual(genericArg.kind, 'primary', 'Expected generic argument to be primary');
			assert.strictEqual(genericArg.name, 'string', 'Expected generic argument name to be "string"');
		});

		test('should parse nested generic types', () => {
			const input = 'Map<string, Array<number>>';
			const parser = new TypeScriptTypeParser(input);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a primary type "Map" with two generic arguments
			assert.strictEqual(result.kind, 'primary', 'Expected token kind to be "primary"');
			assert.strictEqual(result.name, 'Map', 'Expected type name to be "Map"');
			assert.ok(result.genericArguments, 'Expected generic arguments to be present');
			assert.strictEqual(result.genericArguments!.length, 2, 'Expected two generic arguments');

			// First generic argument should be "string"
			const firstArg = result.genericArguments![0];
			assert.strictEqual(firstArg.kind, 'primary', 'Expected first generic argument to be primary');
			assert.strictEqual(firstArg.name, 'string', 'Expected first generic argument to be "string"');

			// Second generic argument should be "Array<number>"
			const secondArg = result.genericArguments![1];
			assert.strictEqual(secondArg.kind, 'primary', 'Expected second generic argument to be primary');
			assert.strictEqual(secondArg.name, 'Array', 'Expected second generic argument name to be "Array"');
			assert.ok(secondArg.genericArguments, 'Expected nested generic arguments in second argument');
			assert.strictEqual(secondArg.genericArguments!.length, 1, 'Expected one nested generic argument');
			const nestedArg = secondArg.genericArguments![0];
			assert.strictEqual(nestedArg.kind, 'primary', 'Expected nested generic argument to be primary');
			assert.strictEqual(nestedArg.name, 'number', 'Expected nested generic argument name to be "number"');
		});

		test('should parse a parenthesized type', () => {
			const input = '(A | B)';
			const parser = new TypeScriptTypeParser(input);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a parenthesized token whose inner type is a union of "A" and "B"
			assert.strictEqual(result.kind, 'parenthesized', 'Expected token kind to be "parenthesized"');
			assert.ok(result.subTypes && result.subTypes!.length === 1, 'Expected one inner type in parenthesized token');

			const innerType = result.subTypes![0];
			assert.strictEqual(innerType.kind, 'union', 'Expected inner type to be a union');
			assert.ok(innerType.subTypes, 'Expected union inner type to have subTypes');
			assert.strictEqual(innerType.subTypes!.length, 2, 'Expected two subtypes in the union');
			assert.strictEqual(innerType.subTypes![0].name, 'A', 'Expected first subtype to be "A"');
			assert.strictEqual(innerType.subTypes![1].name, 'B', 'Expected second subtype to be "B"');
		});

		test('should parse a complex type with whitespace and newlines', () => {
			const input = `
	  Promise <
		 Result < A | B ,
		 Error
		 >
	  >
	`;
			const trimmedInput = input.trim();
			const parser = new TypeScriptTypeParser(trimmedInput);
			const result: ParsedTypeToken = parser.parseType();

			// Expect a primary type "Promise" with one generic argument "Result< A | B, Error >"
			assert.strictEqual(result.kind, 'primary', 'Expected token kind to be "primary"');
			assert.strictEqual(result.name, 'Promise', 'Expected type name to be "Promise"');
			assert.ok(result.genericArguments, 'Expected generic arguments to be present');
			assert.strictEqual(result.genericArguments!.length, 1, 'Expected one generic argument for Promise');

			const resultArg = result.genericArguments![0];
			assert.strictEqual(resultArg.kind, 'primary', 'Expected generic argument to be primary');
			assert.strictEqual(resultArg.name, 'Result', 'Expected generic argument name to be "Result"');
			assert.ok(resultArg.genericArguments, 'Expected nested generic arguments in Result');
			assert.strictEqual(resultArg.genericArguments!.length, 2, 'Expected two generic arguments in Result');

			// First generic argument of Result should be a union "A | B"
			const unionArg = resultArg.genericArguments![0];
			assert.strictEqual(unionArg.kind, 'union', 'Expected first generic argument of Result to be a union');
			assert.ok(unionArg.subTypes, 'Expected union to have subTypes');
			assert.strictEqual(unionArg.subTypes!.length, 2, 'Expected two subtypes in the union');
			assert.strictEqual(unionArg.subTypes![0].name, 'A', 'Expected first union subtype to be "A"');
			assert.strictEqual(unionArg.subTypes![1].name, 'B', 'Expected second union subtype to be "B"');

			// Second generic argument of Result should be "Error"
			const errorArg = resultArg.genericArguments![1];
			assert.strictEqual(errorArg.kind, 'primary', 'Expected second generic argument of Result to be primary');
			assert.strictEqual(errorArg.name, 'Error', 'Expected second generic argument to be "Error"');
		});

	});

});




suite('TypeScriptCodeBuilder - Object Modifications', () => {

	test('Should update property values in a simple object literal', async () => {
		const input = `const location = { id: 'village', name: 'Old Village' };`;
		const expected = `const location = { id: 'new-village', name: 'New Village' };`;

		const builder = new TypeScriptCodeBuilder();
		builder.parseText(input);
		// Locate the object literal for the variable "location"
		builder.findObject('location', {
			onFound: (objectBuilder) => {
				// Replace the value of the property "id"
				objectBuilder.setPropertyValue('id', "'new-village'");
				// Replace the value of the property "name"
				objectBuilder.setPropertyValue('name', "'New Village'");
			},
			onNotFound: () => {
				assert.fail('Expected to find object literal for variable "location"');
			}
		});

		const result = await builder.toString();
		assert.strictEqual(result, expected);
	});

	test('Should leave code unchanged if no matching property is found', async () => {
		const input = `const user = { username: 'admin' };`;
		// Expect the original text because no edit is scheduled
		const expected = input;

		const builder = new TypeScriptCodeBuilder();
		builder.parseText(input);
		builder.findObject('user', {
			onFound: (objectBuilder) => {
				// Attempt to change a property that does not exist.
				objectBuilder.setPropertyValue('password', "'secret'");
			}
		});

		const result = await builder.toString();
		assert.strictEqual(result, expected);
	});
});

/**
 * Suite of tests for modifying nested array literals.
 */
suite('TypeScriptCodeBuilder - Array Modifications', () => {

	test('Should update object items inside an array literal', async () => {
		const input = `
const location = {
  sublocations: [
	{ id: 'market' },
	{ id: 'church' }
  ]
};
`;
		const expected = `
const location = {
  sublocations: [
	{ id: 'new-market' },
	{ id: 'new-church' }
  ]
};
`;
		const builder = new TypeScriptCodeBuilder();
		builder.parseText(input);
		builder.findObject('location', {
			onFound: (objectBuilder) => {
				// Find the array literal assigned to property "sublocations"
				objectBuilder.findArray('sublocations', {
					onFound: (arrayBuilder) => {
						// Get the object builders for each item in the array
						const items = arrayBuilder.getItems();
						items.forEach((itemBuilder, index) => {
							// For the first item set id to 'new-market'
							// For the second item set id to 'new-church'
							itemBuilder.setPropertyValue('id', index === 0 ? "'new-market'" : "'new-church'");
						});
					}
				});
			}
		});

		const result = await builder.toString();
		assert.strictEqual(result, expected);
	});

	test('Should return the correct number of items from an array literal', () => {
		const input = `
const data = { items: [
  { value: 1 },
  { value: 2 },
  { value: 3 }
] };
`;
		const builder = new TypeScriptCodeBuilder();
		builder.parseText(input);
		let itemsCount = 0;
		builder.findObject('data', {
			onFound: (objectBuilder) => {
				objectBuilder.findArray('items', {
					onFound: (arrayBuilder) => {
						const items = arrayBuilder.getItems();
						itemsCount = items.length;
					}
				});
			}
		});
		// We expect three object items in the array literal
		assert.strictEqual(itemsCount, 3, 'Expected three object items in the array literal');
	});
});

/**
 * Suite to test that no modifications results in the original code.
 */
suite('TypeScriptCodeBuilder - No Modification', () => {

	test('Should return original code if no edits were scheduled', async () => {
		const input = `const a = 123;`;
		const builder = new TypeScriptCodeBuilder();
		builder.parseText(input);
		const result = await builder.toString();
		assert.strictEqual(result, input);
	});
});




suite("TypeScriptTypeBuilder and findType Functionality", () => {
  test("should retrieve a simple primary type from a type annotation", async () => {
    const input = `const x: number = 123;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    let retrievedType = "";
    // Locate the type annotation for variable "x"
    builder.findType("x", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        retrievedType = typeBuilder.getTypeText();
      },
    });
    assert.strictEqual(retrievedType, "number", "Expected type text to be 'number'");
  });

  test("should list union types from a union type annotation", async () => {
    const input = `const y: A | B | C = someValue;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    let unionTypes: string[] = [];
    builder.findType("y", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        unionTypes = typeBuilder.getUnionTypes();
      },
    });
    assert.deepStrictEqual(
      unionTypes,
      ["A", "B", "C"],
      "Expected union types to be ['A', 'B', 'C']"
    );
  });

  test("should add a new union type to a primary type", async () => {
    // The variable "z" is originally annotated with type 'number'.
    // After adding 'string' to the union, the type should be "number | string".
    const input = `const z: number = 123;`;
    const expected = `const z: number | string = 123;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    builder.findType("z", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        typeBuilder.addUnionType("string");
      },
    });
    const result = await builder.toString();
    assert.strictEqual(result, expected, "Expected the type annotation to be updated to a union");
  });

  test("should replace the entire type annotation using setType", async () => {
    // The variable "a" is originally annotated with type 'boolean'.
    // After replacing it with 'string', the type annotation should change.
    const input = `const a: boolean = true;`;
    const expected = `const a: string = true;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    builder.findType("a", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        typeBuilder.setType("string");
      },
    });
    const result = await builder.toString();
    assert.strictEqual(result, expected, "Expected the type annotation to be replaced with 'string'");
  });

  test("should leave code unchanged if variable is not found", async () => {
    // If a variable is not found, no edits should be scheduled.
    const input = `const b: number = 456;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    builder.findType("nonexistent", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        typeBuilder.setType("string");
      },
    });
    const result = await builder.toString();
    assert.strictEqual(result, input, "Expected no modifications when variable is not found");
  });

  test("should handle type annotations with extra whitespace", async () => {
    // For input with extra whitespace, the updated region is replaced so that the
    // final code has exactly one space after the colon and one space before the delimiter.
    const input = `const c:   number    = 789;`;
    const expected = `const c: number | null = 789;`;
    const builder = new TypeScriptCodeBuilder();
    builder.parseText(input);
    builder.findType("c", {
      onFound: (typeBuilder: TypeScriptTypeBuilder) => {
        // Append 'null' to the existing primary type 'number'
        typeBuilder.addUnionType("null");
      },
    });
    const result = await builder.toString();
    assert.strictEqual(result, expected, "Expected extra whitespace to be normalized in the updated type annotation");
  });
});
