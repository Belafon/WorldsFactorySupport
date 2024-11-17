import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeModification, TypeScriptCodeBuilder, TypeScriptObjectBuilder } from '../typescriptObjectParser/TypeScriptCodeBuilder';

suite('TypeScript Code Builder Test Suite', () => {
    vscode.window.showInformationMessage('Starting TypeScript Code Builder tests.');

    suite('Object Finding and Modification Tests', () => {
        test('Should find and modify existing object property', async () => {
            const input = `
export const villageLocation = {
    id: 'village',
    name: 'Village',
    description: 'A peaceful village',
    sublocations: [
        { id: 'market' }
    ]
};`;
            const expected = `
export const villageLocation = {
    id: 'new-village',
    name: 'Village',
    description: 'A peaceful village',
    sublocations: [
        { id: 'market' }
    ]
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);


            builder.findObject('villageLocation', {
                onFound: (objectBuilder) => {
                    objectBuilder.setPropertyValue('id', "'new-village'");
                },
                onNotFound: (name) => {
                    assert.fail(`Should have found object ${name}`);
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });

        test('Should handle object not found case', () => {
            const input = `const emptyObject = {};`;
            let notFoundCalled = false;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('nonexistentObject', {
                onFound: () => {
                    assert.fail('Should not find non-existent object');
                },
                onNotFound: () => {
                    notFoundCalled = true;
                }
            });

            assert.strictEqual(notFoundCalled, true);
        });

        test('Should preserve formatting when modifying objects', async () => {
            const input = `
const location = {
    id:     'old-id',  // with extra spaces
    name:   'Name',    // and comments
};`;
            const expected = `
const location = {
    id:     'new-id',  // with extra spaces
    name:   'Name',    // and comments
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.setPropertyValue('id', "'new-id'");
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });
    });

    suite('Array Manipulation Tests', () => {
        test('Should find and modify array items', async () => {
            const input = `
const location = {
    sublocations: [
        { id: 'market' },
        { id: 'church' }
    ]
};`;
            const expected = `
const location = {
    sublocations: [
        { id: 'new-market' },
        { id: 'church' }
    ]
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.findArray('sublocations', {
                        onFound: (builders) => {
                            const firstItem = builders[0];
                            firstItem.setPropertyValue('id', "'new-market'");
                        }
                    });
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });

        test('Should add new array when not found', async () => {
            const input = `
const location = {
    id: 'village'
};`;
            const expected = `
const location = {
    id: 'village',
    sublocations: [
        { id: 'new-sublocation' }
    ]
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.findArray('sublocations', {
                        onFound: () => {
                            assert.fail('Should not find non-existent array');
                        },
                        onNotFound: () => {
                            objectBuilder.addArray('sublocations', (arrayBuilder) => {
                                arrayBuilder.addNewObject((objBuilder) => {
                                    objBuilder.setPropertyValue('id', "'new-sublocation'");
                                });
                            });
                        }
                    });
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });
    });

    suite('Property Manipulation Tests', () => {
        test('Should add new property to existing object', async () => {
            const input = `
const location = {
    id: 'village'
};`;
            const expected = `
const location = {
    id: 'village',
    name: 'New Village'
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.addProperty('name', "'New Village'");
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });

        test('Should handle property not found case', () => {
            const input = `const location = { id: 'village' };`;
            let notFoundCalled = false;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.findProperty('nonexistent', {
                        onFound: () => {
                            assert.fail('Should not find non-existent property');
                        },
                        onNotFound: () => {
                            notFoundCalled = true;
                        }
                    });
                }
            });

            assert.strictEqual(notFoundCalled, true);
        });
    });

    suite('Error Handling Tests', () => {
        test('Should handle malformed object syntax', () => {
            const input = `const location = { id: 'village' // missing closing brace`;
            let errorCalled = false;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: () => {
                    assert.fail('Should not process malformed object');
                },
                onError: (error) => {
                    errorCalled = true;
                    assert.ok(error instanceof Error);
                }
            });

            assert.strictEqual(errorCalled, true);
        });

        test('Should handle nested object errors', () => {
            const input = `
const location = {
    sublocations: [
        { id: 'market',
        // malformed nested object
    ]
};`;
            let errorCalled = false;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.findArray('sublocations', {
                        onFound: () => {
                            assert.fail('Should not process malformed array');
                        },
                        onError: (error) => {
                            errorCalled = true;
                            assert.ok(error instanceof Error);
                        }
                    });
                }
            });

            assert.strictEqual(errorCalled, true);
        });
    });

    suite('Complex Modification Tests', () => {
        test('Should handle multiple modifications in one pass', async () => {
            const input = `
const location = {
    id: 'village',
    sublocations: [
        { id: 'market' },
        { id: 'church' }
    ],
    name: 'Old Village'
};`;
            const expected = `
const location = {
    id: 'new-village',
    sublocations: [
        { id: 'new-market' },
        { id: 'new-church' }
    ],
    name: 'New Village'
};`;

            const builder = new TypeScriptCodeBuilder();
            builder.parseText(input);

            builder.findObject('location', {
                onFound: (objectBuilder) => {
                    objectBuilder.setPropertyValue('id', "'new-village'");
                    objectBuilder.setPropertyValue('name', "'New Village'");

                    objectBuilder.findArray('sublocations', {
                        onFound: (builders) => {
                            builders.forEach((builder, index) => {
                                builder.setPropertyValue('id',
                                    index === 0 ? "'new-market'" : "'new-church'"
                                );
                            });
                        }
                    });
                }
            });

            assert.strictEqual(builder.toString(), expected);
        });
    });
});












suite('TypeScript Code Builder findObject Tests', () => {
    vscode.window.showInformationMessage('Starting findObject specific tests.');

    test('Should find object with const declaration', async () => {
        const input = `
const myObject = {
    id: 'test'
};`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                foundCalled = true;
            }
        });

        assert.strictEqual(foundCalled, true);
    });

    test('Should find object with export const declaration', async () => {
        const input = `
export const myObject = {
    id: 'test'
};`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                foundCalled = true;
            }
        });

        assert.strictEqual(foundCalled, true);
    });

    test('Should not find nested object with same name', async () => {
        const input = `
const parentObject = {
    myObject: {
        id: 'test'
    }
};`;
        let notFoundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: () => {
                assert.fail('Should not find nested object');
            },
            onNotFound: () => {
                notFoundCalled = true;
            }
        });

        assert.strictEqual(notFoundCalled, true);
    });

    test('Should find first level object when same name exists in nested context', async () => {
        const input = `
const myObject = {
    id: 'root'
};

const parent = {
    myObject: {
        id: 'nested'
    }
};`;
        let foundId: string | undefined;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        foundId = value;
                    }
                });
            }
        });

        assert.strictEqual(foundId, "'root'");
    });

    test('Should handle multiple braces before target object', async () => {
        const input = `
const obj1 = {
    nested: {
        deep: {
            value: true
        }
    }
};

const targetObject = {
    id: 'found'
};`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('targetObject', {
            onFound: (objectBuilder) => {
                foundCalled = true;
            }
        });

        assert.strictEqual(foundCalled, true);
    });

    test('Should ignore object name in string literals', async () => {
        const input = `
const str = "const myObject = {}";
const myObject = {
    id: 'real'
};`;
        let foundId: string | undefined;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        foundId = value;
                    }
                });
            }
        });

        assert.strictEqual(foundId, "'real'");
    });

    test('Should handle nested arrays with objects', async () => {
        const input = `
const items = [
    { id: '1' },
    { myObject: { id: 'nested' } }
];

const myObject = {
    id: 'root'
};`;
        let foundId: string | undefined;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        foundId = value;
                    }
                });
            }
        });

        assert.strictEqual(foundId, "'root'");
    });

    test('Should handle object property definition syntax', async () => {
        const input = `
const parent = {
    prop1: {},
    myObject: {
        id: 'nested'
    },
};

const myObject = {
    id: 'root'
};`;
        let foundId: string | undefined;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        foundId = value;
                    }
                });
            }
        });

        assert.strictEqual(foundId, "'root'");
    });

    test('Should maintain correct nesting level with mixed braces and brackets', async () => {
        const input = `
const mixed = {
    array: [
        { nested: { deep: true } },
        { myObject: { id: 'nested' } }
    ]
};

const myObject = {
    id: 'root'
};`;
        let foundId: string | undefined;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        foundId = value;
                    }
                });
            }
        });

        assert.strictEqual(foundId, "'root'");
    });
});









suite('TypeScript Object Builder Tests', () => {
    vscode.window.showInformationMessage('Starting TypeScript Object Builder tests.');

    suite('Property Finding Tests', () => {
        test('Should find property at root level', () => {
            const input = `{
    rootProp: 'value',
    nested: {
        rootProp: 'wrong'
    }
}`;
            let foundValue: string | undefined;
            const modifications: CodeModification[] = [];

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, modifications);
            builder.findProperty('rootProp', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue, "'value'");
        });

        test('Should not find nested property with same name', () => {
            const input = `{
    outer: {
        target: 'wrong'
    },
    other: 'value'
}`;
            let notFoundCalled = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('target', {
                onFound: () => {
                    assert.fail('Should not find nested property');
                },
                onNotFound: () => {
                    notFoundCalled = true;
                }
            });

            assert.strictEqual(notFoundCalled, true);
        });

        test('Should find property with string containing object-like content', () => {
            const input = `{
    prop: 'value: { nested: true }',
    actual: 'correct'
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('actual', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue, "'correct'");
        });

        test('Should find property after array with nested objects', () => {
            const input = `{
    arr: [
        { prop: 'skip' },
        { prop: 'skip2' }
    ],
    target: 'found'
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('target', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue, "'found'");
        });
    });

    suite('Array Finding Tests', () => {
        test('Should find array at root level', () => {
            const input = `{
    rootArray: [1, 2, 3],
    nested: {
        rootArray: [4, 5, 6]
    }
}`;
            let arrayFound = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findArray('rootArray', {
                onFound: () => {
                    arrayFound = true;
                }
            });

            assert.strictEqual(arrayFound, true);
        });

        test('Should not find nested array with same name', () => {
            const input = `{
    outer: {
        targetArray: [1, 2, 3]
    }
}`;
            let notFoundCalled = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findArray('targetArray', {
                onFound: () => {
                    assert.fail('Should not find nested array');
                },
                onNotFound: () => {
                    notFoundCalled = true;
                }
            });

            assert.strictEqual(notFoundCalled, true);
        });

        test('Should find array with objects containing similar property names', () => {
            const input = `{
    items: [
        { name: 'first', items: [1, 2] },
        { name: 'second', items: [3, 4] }
    ],
    items2: ['correct']
}`;
            let foundCorrectArray = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findArray('items2', {
                onFound: (items) => {
                    foundCorrectArray = true;
                }
            });

            assert.strictEqual(foundCorrectArray, true);
        });
    });

    suite('Property Modification Tests', () => {
        test('Should modify root level property value', () => {
            const input = `{
    target: 'old',
    nested: {
        target: 'wrong'
    }
}`;
            const modifications: CodeModification[] = [];
            const builder = new TypeScriptObjectBuilder(input, 0, input.length, modifications);

            builder.setPropertyValue('target', "'new'");

            assert.strictEqual(modifications.length, 1);
            assert.strictEqual(modifications[0].replacement, "'new'");
        });

        test('Should add new property at root level', () => {
            const input = `{
    existing: 'value'
}`;
            const modifications: CodeModification[] = [];
            const builder = new TypeScriptObjectBuilder(input, 0, input.length, modifications);

            builder.addProperty('newProp', "'newValue'");

            assert.strictEqual(modifications.length, 1);
            const result = input.slice(0, modifications[0].start) + 
                          modifications[0].replacement + 
                          input.slice(modifications[0].end);
            assert.match(result, /newProp: 'newValue'/);
        });
    });

    suite('Complex Scenarios Tests', () => {
        test('Should handle properties with complex values', () => {
            const input = `{
    prop: \`template \${with} \${expressions}\`,
    nested: {
        prop: 'wrong'
    }
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('prop', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue?.includes('template'), true);
        });

        test('Should handle multiple levels of nesting with same names', () => {
            const input = `{
    level1: {
        target: 'wrong',
        level2: {
            target: 'wrong2'
        }
    },
    target: 'correct'
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('target', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue, "'correct'");
        });

        test('Should handle escaped quotes in string values', () => {
            const input = `{
    prop: 'value with \\'quotes\\'',
    nested: {
        prop: 'wrong'
    }
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('prop', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue?.includes('quotes'), true);
        });

        test('Should handle properties with similar names', () => {
            const input = `{
    longPropertyName: 'wrong',
    longProperty: 'correct',
    nested: {
        longProperty: 'wrong'
    }
}`;
            let foundValue: string | undefined;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findProperty('longProperty', {
                onFound: (value) => {
                    foundValue = value;
                }
            });

            assert.strictEqual(foundValue, "'correct'");
        });
    });

    suite('Error Handling Tests', () => {
        test('Should handle malformed object structure', () => {
            const input = `{
    prop: 'value',
    broken: {
        nested: true
    // missing closing brace
}`;
            let errorCalled = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findArray('broken', {
                onFound: () => {
                    assert.fail('Should not find array in malformed object');
                },
                onError: (error) => {
                    errorCalled = true;
                    assert.ok(error instanceof Error);
                }
            });

            assert.strictEqual(errorCalled, true);
        });

        test('Should handle property with malformed array value', () => {
            const input = `{
    prop: 'value',
    array: [
        1, 2, 3
    // missing closing bracket
}`;
            let errorCalled = false;

            const builder = new TypeScriptObjectBuilder(input, 0, input.length, []);
            builder.findArray('array', {
                onFound: () => {
                    assert.fail('Should not find malformed array');
                },
                onError: (error) => {
                    errorCalled = true;
                    assert.ok(error instanceof Error);
                }
            });

            assert.strictEqual(errorCalled, true);
        });
    });
});










