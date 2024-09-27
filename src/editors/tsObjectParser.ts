import * as fs from 'fs';
import * as ts from 'typescript';

type ParsedObject = Record<string, any>;

export function parseTypeScriptFile(filePath: string, typePattern: string = 'TEvent'): ParsedObject {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Create a TypeScript program
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

    const parsedObjects: ParsedObject = {};

    // Helper function to safely evaluate expressions
    function safeEval(node: ts.Node): any {
        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
                return (node as ts.StringLiteral).text;
            case ts.SyntaxKind.NumericLiteral:
                return parseFloat((node as ts.NumericLiteral).text);
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.ObjectLiteralExpression:
                const obj: Record<string, any> = {};
                (node as ts.ObjectLiteralExpression).properties.forEach(prop => {
                    if (ts.isPropertyAssignment(prop)) {
                        const name = prop.name.getText(sourceFile);
                        obj[name] = safeEval(prop.initializer);
                    }
                });
                return obj;
            case ts.SyntaxKind.ArrayLiteralExpression:
                return (node as ts.ArrayLiteralExpression).elements.map(element => safeEval(element));
            case ts.SyntaxKind.CallExpression:
                const callExpr = node as ts.CallExpression;
                if (callExpr.expression.getText(sourceFile) === 'Time.fromString') {
                    if (callExpr.arguments.length > 0 && callExpr.arguments[0].kind === ts.SyntaxKind.StringLiteral) {
                        return (callExpr.arguments[0] as ts.StringLiteral).text;
                    }
                }
                // For other function calls, return the text representation
                return node.getText(sourceFile);
            default:
                // For other cases, return the text representation
                return node.getText(sourceFile);
        }
    }

    // Traverse the AST
    function visit(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.VariableStatement) {
            const varStmt = node as ts.VariableStatement;
            const declaration = varStmt.declarationList.declarations[0];
            if (ts.isVariableDeclaration(declaration) && declaration.type) {
                const typeText = declaration.type.getText(sourceFile);
                if (typeText.startsWith(typePattern)) {
                    const objectName = declaration.name.getText(sourceFile);
                    if (declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
                        parsedObjects[objectName] = safeEval(declaration.initializer);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return parsedObjects;
}

export function getObjectByType<T>(parsedObjects: ParsedObject, propertyName: string = 'eventId'): T | undefined {
    for (const [, value] of Object.entries(parsedObjects)) {
        if (value && typeof value === 'object' && propertyName in value) {
            return value as T;
        }
    }
    return undefined;
}