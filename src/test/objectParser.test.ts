import * as assert from 'assert';
import * as vscode from 'vscode';
import { CodeModification, ObjectBuilder, PropertyTrackingObjectBuilder, TypeScriptArrayBuilder, TypeScriptCodeBuilder, TypeScriptObjectBuilder } from '../typescriptObjectParser/TypeScriptCodeBuilder';

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
                        onFound: (arrayBuilder) => {
                            // Get the array items
                            const items = arrayBuilder.getItems();

                            // Modify the first item
                            const firstItem = items[0];
                            firstItem.setPropertyValue('id', "'new-market'");
                        }
                    });
                }
            });

            // Verify the modification
            assert.strictEqual(await builder.toString(), expected);
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
                        onFound: (arrayBuilder) => {
                            // Get the object builders for the array items
                            const items = arrayBuilder.getItems();

                            // Update each item's id property
                            items.forEach((itemBuilder, index) => {
                                itemBuilder.setPropertyValue('id',
                                    index === 0 ? "'new-market'" : "'new-church'"
                                );
                            });
                        }
                    });
                }
            });

            assert.strictEqual(await builder.toString(), expected);
        });
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


    test('Should find property in found object', () => {
        const input = `
const myObject = {
    id: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        // Get the object builder
        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = builder;
            }
        });

        // Find the property in the object
        let foundValue: string | undefined;
        objectBuilder?.findProperty('id', {
            onFound: (value) => {
                foundValue = value;
            }
        });

        assert.strictEqual(foundValue, "'test'");
    });


    test('Should find and modify property in found object', async () => {
        const input = `
const myObject = {
    id: 'original',
    name: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = builder;
            }
        });

        if (!objectBuilder) {
            assert.fail('Object builder should be found');
        }

        // Test finding existing property
        let foundValue: string | undefined;
        objectBuilder.findProperty('id', {
            onFound: (value) => {
                foundValue = value;
            }
        });
        assert.strictEqual(foundValue, "'original'");

        // Test modifying property
        objectBuilder.setPropertyValue('id', "'modified'");

        // Verify modification
        let modifiedValue: string | undefined;
        objectBuilder.findProperty('id', {
            onFound: (value) => {
                modifiedValue = value;
            }
        });
        assert.strictEqual(modifiedValue, "'modified'");
    });


    test('Should add new property to found object', async () => {
        const input = `
const myObject = {
    id: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = builder;
            }
        });

        if (!objectBuilder) {
            assert.fail('Object builder should be found');
        }

        // Add new property
        objectBuilder.addProperty('newProp', "'added'");

        // Verify new property exists
        let addedValue: string | undefined;
        objectBuilder.findProperty('newProp', {
            onFound: (value) => {
                addedValue = value;
            }
        });
        assert.strictEqual(addedValue, "'added'");
    });

    test('Should find nested object in found object', async () => {
        const input = `
const myObject = {
    nested: {
        id: 'inner',
        data: 'test'
    }
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = builder;
            }
        });

        if (!objectBuilder) {
            assert.fail('Object builder should be found');
        }

        let nestedBuilder: ObjectBuilder | undefined;
        objectBuilder.findObject('nested', {
            onFound: (builder) => {
                nestedBuilder = builder;
            }
        });

        if (!nestedBuilder) {
            assert.fail('Nested object builder should be found');
        }

        // Test finding properties in nested object
        let nestedId: string | undefined;
        nestedBuilder.findProperty('id', {
            onFound: (value) => {
                nestedId = value;
            }
        });
        assert.strictEqual(nestedId, "'inner'");

        let nestedData: string | undefined;
        nestedBuilder.findProperty('data', {
            onFound: (value) => {
                nestedData = value;
            }
        });
        assert.strictEqual(nestedData, "'test'");
    });
});


suite('Property Tracking Object Builder Tests', () => {
    vscode.window.showInformationMessage('Starting Property Tracking Object Builder tests.');

    test('Should track property initialization and changes', () => {
        const input = `
const myObject = {
    id: 'test',
    age: 25
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = new PropertyTrackingObjectBuilder(builder, {
                    strictTypes: true,
                    trackHistory: true
                });
            }
        });

        if (!objectBuilder) {
            assert.fail('Object builder should be found');
        }

        // Register properties
        const trackedBuilder = objectBuilder as PropertyTrackingObjectBuilder;
        trackedBuilder.registerProperty('id', 'string', { required: true });
        trackedBuilder.registerProperty('age', 'number');

        // Verify initial values are tracked
        let idValue: string | undefined;
        let ageValue: string | undefined;

        trackedBuilder.findProperty('id', {
            onFound: (value) => {
                idValue = value;
            }
        });

        trackedBuilder.findProperty('age', {
            onFound: (value) => {
                ageValue = value;
            }
        });

        assert.strictEqual(idValue, "'test'");
        assert.strictEqual(ageValue, "25");

        // Modify property and check history
        trackedBuilder.setPropertyValue('id', "'modified'");
        const idHistory = trackedBuilder.getPropertyHistory('id');

        assert.strictEqual(idHistory.length, 2); // Initial value + modification
        assert.strictEqual(idHistory[1].oldValue, "'test'");
        assert.strictEqual(idHistory[1].newValue, "'modified'");
        assert.strictEqual(idHistory[1].type, 'modify');
    });

    test('Should validate property types', () => {
        const input = `
const myObject = {
    id: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    strictTypes: true,
                    validateOnChange: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register property with type
        trackedBuilder.registerProperty('id', 'string');
        trackedBuilder.registerProperty('age', 'number');

        // Try setting invalid type
        trackedBuilder.setPropertyValue('age', "'invalid'");

        // Check validation errors
        const errors = trackedBuilder.getValidationErrors();
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].code, 'TYPE_ERROR');
        assert.strictEqual(errors[0].propertyName, 'age');
    });

    test('Should handle custom validation rules', () => {
        const input = `
const myObject = {
    age: 25
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    validateOnChange: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register property with custom validation
        trackedBuilder.registerProperty('age', 'number', {
            validation: (value) => value >= 0 && value <= 120
        });

        // Try setting invalid value
        trackedBuilder.setPropertyValue('age', '150');

        // Check validation errors
        const errors = trackedBuilder.getValidationErrors();
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].code, 'VALIDATION_ERROR');
    });

    test('Should track multiple property changes', () => {
        const input = `
const myObject = {
    id: 'test',
    name: 'John',
    age: 25
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register multiple properties
        trackedBuilder.registerProperty('id', 'string');
        trackedBuilder.registerProperty('name', 'string');
        trackedBuilder.registerProperty('age', 'number');

        // Make multiple changes
        trackedBuilder.setPropertyValue('id', "'user123'");
        trackedBuilder.setPropertyValue('name', "'Jane'");
        trackedBuilder.setPropertyValue('age', '30');

        // Check history for each property
        const idHistory = trackedBuilder.getPropertyHistory('id');
        const nameHistory = trackedBuilder.getPropertyHistory('name');
        const ageHistory = trackedBuilder.getPropertyHistory('age');

        assert.strictEqual(idHistory.length, 2);
        assert.strictEqual(nameHistory.length, 2);
        assert.strictEqual(ageHistory.length, 2);

        // Verify latest changes
        assert.strictEqual(idHistory[1].newValue, "'user123'");
        assert.strictEqual(nameHistory[1].newValue, "'Jane'");
        assert.strictEqual(ageHistory[1].newValue, '30');
    });

    test('Should handle property addition', () => {
        const input = `
const myObject = {
    id: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register and add new property
        trackedBuilder.registerProperty('newProp', 'string');
        trackedBuilder.addProperty('newProp', "'added'");

        // Check history
        const propHistory = trackedBuilder.getPropertyHistory('newProp');
        assert.strictEqual(propHistory.length, 1);
        assert.strictEqual(propHistory[0].type, 'add');
        assert.strictEqual(propHistory[0].newValue, "'added'");
    });

    test('Should validate required properties', () => {
        const input = `
const myObject = {};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    validateOnChange: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register required property
        trackedBuilder.registerProperty('id', 'string', { required: true });

        // Validate all properties
        const errors = trackedBuilder.validateAllProperties();
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].code, 'REQUIRED_ERROR');
    });

    test('Should respect maxHistoryLength option', () => {
        const input = `
const myObject = {
    counter: 0
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true,
                    maxHistoryLength: 3
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register property
        trackedBuilder.registerProperty('counter', 'number');

        // Make multiple changes
        trackedBuilder.setPropertyValue('counter', '1');
        trackedBuilder.setPropertyValue('counter', '2');
        trackedBuilder.setPropertyValue('counter', '3');
        trackedBuilder.setPropertyValue('counter', '4');

        // Check history length is limited
        const history = trackedBuilder.getPropertyHistory('counter');
        assert.strictEqual(history.length, 3);
        assert.strictEqual(history[2].newValue, '4');
    });

    test('Should handle nested object properties', () => {
        const input = `
const myObject = {
    user: {
        id: 'test',
        details: {
            age: 25
        }
    }
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Find nested object
        trackedBuilder.findObject('user', {
            onFound: (userBuilder) => {
                const trackedUserBuilder = userBuilder as PropertyTrackingObjectBuilder;

                // Register and track nested properties
                trackedUserBuilder.registerProperty('id', 'string');

                // Modify nested property
                trackedUserBuilder.setPropertyValue('id', "'modified'");

                // Check history
                const idHistory = trackedUserBuilder.getPropertyHistory('id');
                assert.strictEqual(idHistory.length, 2);
                assert.strictEqual(idHistory[1].newValue, "'modified'");
            }
        });
    });

    test('Should handle array property type', () => {
        const input = `
const myObject = {
    tags: ['a', 'b', 'c']
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    strictTypes: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register array property
        trackedBuilder.registerProperty('tags', 'array');

        // Try setting valid and invalid values
        trackedBuilder.setPropertyValue('tags', "['x', 'y']"); // Valid
        assert.strictEqual(trackedBuilder.getValidationErrors().length, 0);

        trackedBuilder.setPropertyValue('tags', "'invalid'"); // Invalid
        const errors = trackedBuilder.getValidationErrors();
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].code, 'TYPE_ERROR');
    });
});

suite('TypeScript Array Builder Tests', () => {
    test('Should create empty array property', () => {
        const input = `
const myObject = {
    id: 'test'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let objectBuilder: ObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                objectBuilder = builder;
            }
        });

        // Add empty array
        objectBuilder!.addArray('newArray', () => { });

        // Verify array exists
        let arrayFound = false;
        objectBuilder!.findArray('newArray', {
            onFound: () => {
                arrayFound = true;
            }
        });

        assert.strictEqual(arrayFound, true);
    });

    test('Should add object to array', () => {
        const builder = new TypeScriptArrayBuilder(
            '',  // empty source
            0,   // start
            0,   // end
            []   // no modifications yet
        );

        let objectFound = false;
        builder.addNewObject((objBuilder) => {
            objectFound = true;
        });

        const items = builder.getItems();
        assert.strictEqual(items.length, 1);
        assert.strictEqual(objectFound, true);
    });

    test('Should add multiple objects to array', () => {
        const builder = new TypeScriptArrayBuilder(
            '',  // empty source
            0,   // start
            0,   // end
            []   // no modifications yet
        );

        let objectCount = 0;
        builder.addNewObject((objBuilder) => {
            objectCount++;
        });

        builder.addNewObject((objBuilder) => {
            objectCount++;
        });

        const items = builder.getItems();
        assert.strictEqual(items.length, 2);
        assert.strictEqual(objectCount, 2);
    });

    test('Should get item from array', () => {
        const input = `
        const myObject = {
            myArray: ['item1']
        };`;
        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('myObject', {
            onFound: (objBuilder) => {
                objBuilder.findArray('myArray', {
                    onFound: (arrayBuilder) => {
                        const item = arrayBuilder.getItems()[0];
                        assert.strictEqual(item, "'item1'");
                    }
                });
            }
        }); 
    });
});



suite('Property Tracking Object Builder Additional Tests', () => {
    test('Should handle null and undefined property values', () => {
        const input = `
const myObject = {
    required: null,
    optional: undefined
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    strictTypes: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties
        trackedBuilder.registerProperty('required', 'any', { required: true });
        trackedBuilder.registerProperty('optional', 'any');

        // Validate all properties
        const errors = trackedBuilder.validateAllProperties();

        // Required property with null should still trigger required error
        assert.strictEqual(errors.length, 1);
        assert.strictEqual(errors[0].code, 'REQUIRED_ERROR');
        assert.strictEqual(errors[0].propertyName, 'required');
    });

    test('Should handle custom validation functions', () => {
        const input = `
const myObject = {
    email: 'test@example.com',
    age: 25
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    validateOnChange: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties with custom validation
        trackedBuilder.registerProperty('email', 'string', {
            validation: (value) => value.includes('@') && value.includes('.')
        });
        trackedBuilder.registerProperty('age', 'number', {
            validation: (value) => value >= 0 && value <= 120
        });

        // Test valid values
        trackedBuilder.setPropertyValue('email', "'valid@email.com'");
        trackedBuilder.setPropertyValue('age', '30');
        assert.strictEqual(trackedBuilder.getValidationErrors().length, 0);

        // Test invalid values
        trackedBuilder.setPropertyValue('email', "'invalid-email'");
        trackedBuilder.setPropertyValue('age', '150');
        const errors = trackedBuilder.getValidationErrors();
        assert.strictEqual(errors.length, 2);
        assert.strictEqual(errors[0].code, 'VALIDATION_ERROR');
    });

    test('Should properly track nested property changes', () => {
        const input = `
const myObject = {
    user: {
        profile: {
            name: 'John',
            settings: {
                theme: 'dark'
            }
        }
    }
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Track nested changes
        trackedBuilder.findObject('user', {
            onFound: (userBuilder) => {
                const trackedUserBuilder = userBuilder as PropertyTrackingObjectBuilder;
                trackedUserBuilder.findObject('profile', {
                    onFound: (profileBuilder) => {
                        const trackedProfileBuilder = profileBuilder as PropertyTrackingObjectBuilder;

                        // Register and modify nested property
                        trackedProfileBuilder.registerProperty('name', 'string');
                        trackedProfileBuilder.setPropertyValue('name', "'Jane'");

                        // Check history
                        const nameHistory = trackedProfileBuilder.getPropertyHistory('name');
                        assert.strictEqual(nameHistory.length, 2);
                        assert.strictEqual(nameHistory[0].type, 'add');
                        assert.strictEqual(nameHistory[1].type, 'modify');
                    }
                });
            }
        });
    });

    test('Should handle history length limits', () => {
        const input = `
const myObject = {
    counter: 0
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true,
                    maxHistoryLength: 3
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register property
        trackedBuilder.registerProperty('counter', 'number');

        // Make multiple changes
        for (let i = 1; i <= 5; i++) {
            trackedBuilder.setPropertyValue('counter', i.toString());
        }

        // Check history length and contents
        const history = trackedBuilder.getPropertyHistory('counter');
        assert.strictEqual(history.length, 3);
        assert.strictEqual(history[history.length - 1].newValue, '5');
        assert.strictEqual(history[history.length - 2].newValue, '4');
        assert.strictEqual(history[history.length - 3].newValue, '3');
    });

    test('Should handle multiple type validations', () => {
        const input = `
const myObject = {
    stringProp: 'hello',
    numberProp: 42,
    boolProp: true,
    objectProp: { key: 'value' },
    arrayProp: [1, 2, 3]
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    strictTypes: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties with different types
        trackedBuilder.registerProperty('stringProp', 'string');
        trackedBuilder.registerProperty('numberProp', 'number');
        trackedBuilder.registerProperty('boolProp', 'boolean');
        trackedBuilder.registerProperty('objectProp', 'object');
        trackedBuilder.registerProperty('arrayProp', 'array');

        // Test invalid type assignments
        trackedBuilder.setPropertyValue('stringProp', '42');
        trackedBuilder.setPropertyValue('numberProp', "'string'");
        trackedBuilder.setPropertyValue('boolProp', '42');
        trackedBuilder.setPropertyValue('objectProp', "'invalid'");
        trackedBuilder.setPropertyValue('arrayProp', "'not-array'");

        const errors = trackedBuilder.getValidationErrors();
        assert.strictEqual(errors.length, 4); // numberProp, boolProp, objectProp, arrayProp should fail
    });

    test('Should track property deletions', () => {
        const input = `
const myObject = {
    temp: 'temporary',
    permanent: 'stays'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties
        trackedBuilder.registerProperty('temp', 'string');
        trackedBuilder.registerProperty('permanent', 'string');

        // Set property to undefined/null to simulate deletion
        trackedBuilder.setPropertyValue('temp', 'undefined');

        // Check history
        const history = trackedBuilder.getPropertyHistory('temp');
        assert.strictEqual(history.length, 2);
        assert.strictEqual(history[1].type, 'modify');
        assert.strictEqual(history[1].newValue, 'undefined');
    });

    test('Should handle concurrent modifications', () => {
        const input = `
const myObject = {
    prop1: 'value1',
    prop2: 'value2'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    trackHistory: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties
        trackedBuilder.registerProperty('prop1', 'string');
        trackedBuilder.registerProperty('prop2', 'string');

        // Make concurrent modifications
        trackedBuilder.setPropertyValue('prop1', "'new1'");
        trackedBuilder.setPropertyValue('prop2', "'new2'");
        trackedBuilder.setPropertyValue('prop1', "'new3'");

        // Check histories
        const prop1History = trackedBuilder.getPropertyHistory('prop1');
        const prop2History = trackedBuilder.getPropertyHistory('prop2');

        assert.strictEqual(prop1History.length, 3); // initial + 2 modifications
        assert.strictEqual(prop2History.length, 2); // initial + 1 modification
        assert.strictEqual(prop1History[2].newValue, "'new3'");
        assert.strictEqual(prop2History[1].newValue, "'new2'");
    });

    test('Should handle property validation order', () => {
        const input = `
const myObject = {
    username: 'john',
    email: 'john@example.com'
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);
        let trackedBuilder: PropertyTrackingObjectBuilder | undefined;

        builder.findObject('myObject', {
            onFound: (builder) => {
                trackedBuilder = new PropertyTrackingObjectBuilder(builder, {
                    validateOnChange: true
                });
            }
        });

        if (!trackedBuilder) {
            assert.fail('Builder should be found');
        }

        // Register properties with dependent validation
        let username = '';
        trackedBuilder.registerProperty('username', 'string', {
            validation: (value) => {
                username = value;
                return value.length >= 3;
            }
        });

        trackedBuilder.registerProperty('email', 'string', {
            validation: (value) => {
                return value.startsWith(username + '@');
            }
        });

        // Test validation order
        trackedBuilder.setPropertyValue('username', "'jane'");
        trackedBuilder.setPropertyValue('email', "'jane@example.com'");
        assert.strictEqual(trackedBuilder.getValidationErrors().length, 0);

        trackedBuilder.setPropertyValue('email', "'john@example.com'");
        assert.strictEqual(trackedBuilder.getValidationErrors().length, 1);
    });
});



suite('TypeScript Code Builder Type Annotation Tests', () => {
    vscode.window.showInformationMessage('Starting type annotation handling tests.');

    test('Should find object with type annotation', async () => {
        const input = `
import { TLocation } from 'types/TLocation';

export const eeeeLocation: TLocation<'eeee'> = {
    id: 'eeee',
    name: _('eeee'),
    description: \`\`,
    localCharacters: [],
    init: {},
};

export type TEeeeLocationData = {
    
}`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('eeeeLocation', {
            onFound: (objectBuilder) => {
                foundCalled = true;
                // Test that we can read properties
                objectBuilder.findProperty('id', {
                    onFound: (value) => {
                        assert.strictEqual(value, "'eeee'");
                    }
                });
            },
            onNotFound: () => {
                assert.fail('Should have found object eeeeLocation');
            }
        });

        assert.strictEqual(foundCalled, true, 'onFound should have been called');
    });

    test('Should find object with complex generic type annotation', async () => {
        const input = `
export const complexLocation: ComplexType<'test', { nested: string }> = {
    id: 'test'
};`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('complexLocation', {
            onFound: (objectBuilder) => {
                foundCalled = true;
            }
        });

        assert.strictEqual(foundCalled, true);
    });

    test('Should find object with intersection type annotation', async () => {
        const input = `
export const mixedLocation: BaseType & ExtendedType<'test'> = {
    id: 'test'
};`;
        let foundCalled = false;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('mixedLocation', {
            onFound: (objectBuilder) => {
                foundCalled = true;
            }
        });

        assert.strictEqual(foundCalled, true);
    });

    test('Should modify array in typed object', async () => {
        const input = `
export const typedLocation: Location<'test'> = {
    items: ['a', 'b']
};`;
        const expected = `export const typedLocation: Location<'test'> = {
    items: ['a', 'b', 'c'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('typedLocation', {
            onFound: (objectBuilder) => {
                objectBuilder.setPropertyValue('items', "['a', 'b', 'c']");
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should add array to typed object', async () => {
        const input = `
export const typedLocation: Location<'test'> = {
    id: 'test'
};`;
        const expected = `export const typedLocation: Location<'test'> = {
    id: 'test',
    items: ['new'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('typedLocation', {
            onFound: (objectBuilder) => {
                objectBuilder.addArray('items', () => { });
                objectBuilder.setPropertyValue('items', "['new']");
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should add an item to array in typed object', async () => {
        const input = `
export const typedLocation: Location<'test'> = {
    items: ['a']
};`;
        const expected = `export const typedLocation: Location<'test'> = {
    items: ['a', 'b'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('typedLocation', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.addItem("'b'");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });
});


suite('TypeScript Array Builder Remove Item Tests', () => {
    test('Should remove simple string item from array', async () => {
        const input = `
export const testObject = {
    items: ['a', 'b', 'c']
};`;
        const expected = `export const testObject = {
    items: ['a', 'c'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("'b'");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should remove object reference from array', async () => {
        const input = `
export const testObject = {
    items: [objectA, objectB, objectC]
};`;
        const expected = `export const testObject = {
    items: [objectA, objectC],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("objectB");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle removal from array with nested objects', async () => {
        const input = `
export const testObject = {
    items: [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
        { id: 3, name: 'third' }
    ]
};`;
        const expected = `export const testObject = {
    items: [
        { id: 1, name: 'first' },
        { id: 3, name: 'third' },
    ],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("{ id: 2, name: 'second' }");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle array with string literals containing commas', async () => {
        const input = `
export const testObject = {
    items: ['first, item', 'second, remove this', 'third, item']
};`;
        const expected = `export const testObject = {
    items: ['first, item', 'third, item'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("'second, remove this'");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle array with escaped quotes', async () => {
        const input = `
export const testObject = {
    items: ['normal', 'has \\'quotes\\'', 'last']
};`;
        const expected = `export const testObject = {
    items: ['normal', 'last'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("'has \\'quotes\\''");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle array with nested arrays', async () => {
        const input = `
export const testObject = {
    items: [
        [1, 2],
        [3, 4],
        [5, 6]
    ]
};`;
        const expected = `export const testObject = {
    items: [
        [1, 2],
        [5, 6],
    ],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("[3, 4]");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle removal of multiple items', async () => {
        const input = `
export const testObject = {
    items: ['a', 'b', 'c', 'b', 'd']
};`;
        const expected = `export const testObject = {
    items: ['a', 'c', 'd'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("'b'");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle whitespace in array items', async () => {
        const input = `
export const testObject = {
    items: [
        'a',
        'remove this',
        'c'    ]
};`;
        const expected = `export const testObject = {
    items: ['a', 'c'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItem("'remove this'");
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });
});


suite('TypeScript Array Builder RemoveItemAtIndex Tests', () => {
    test('Should remove item at valid index', async () => {
        const input = `
export const testObject = {
    items: ['a', 'b', 'c']
};`;
        const expected = `export const testObject = {
    items: ['a', 'c'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(1);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should throw error for invalid index', () => {
        const input = `
export const testObject = {
    items: ['a', 'b']
};`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        assert.throws(() => {
            builder.findObject('testObject', {
                onFound: (objectBuilder) => {
                    objectBuilder.findArray('items', {
                        onFound: (arrayBuilder) => {
                            arrayBuilder.removeItemAtIndex(5); // Invalid index
                        }
                    });
                }
            });
        }, /Index 5 is out of bounds/);
    });

    test('Should handle nested objects at specified index', async () => {
        const input = `
export const testObject = {
    items: [
        { id: 1 },
        { id: 2 },
        { id: 3 }
    ]
};`;
        const expected = `export const testObject = {\n    items: [{ id: 1 }, { id: 3 }],\n};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(1);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle nested arrays at specified index', async () => {
        const input = `
export const testObject = {
    items: [
        [1, 2],
        [3, 4],
        [5, 6]
    ]
};`;
        const expected = `export const testObject = {
    items: [
        [1, 2],
        [5, 6],
    ],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(1);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should handle array with string literals containing commas at specified index', async () => {
        const input = `
export const testObject = {
    items: ['first, item', 'second, remove this', 'third, item']
};`;
        const expected = `export const testObject = {
    items: ['first, item', 'third, item'],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(1);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Remove last item from array', async () => {
        const input = `
export const testObject = {
    items: ['first']
};`;
        const expected = `export const testObject = {
    items: [],
};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(0);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });

    test('Should maintain formatting when removing last item', async () => {
        const input = `
export const testObject = {
    items: [
        'first',
        'second',
        'last'
    ]
};`;
        const expected = `export const testObject = {\n    items: ['first', 'second'],\n};\n`;

        const builder = new TypeScriptCodeBuilder();
        builder.parseText(input);

        builder.findObject('testObject', {
            onFound: (objectBuilder) => {
                objectBuilder.findArray('items', {
                    onFound: (arrayBuilder) => {
                        arrayBuilder.removeItemAtIndex(2);
                    }
                });
            }
        });

        assert.strictEqual(await builder.toString(), expected);
    });
});