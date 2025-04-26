# WorldsFactorySupport Development Guidelines

## Build Commands
- `yarn compile` - Typecheck, lint, and build
- `yarn watch` - Watch for changes and rebuild
- `yarn check-types` - Run TypeScript type checking
- `yarn lint` - Run ESLint
- `yarn test` - Run tests
- `yarn generate-api` - Generate API client from OpenAPI spec

## Code Style Guidelines
- Use TypeScript for all files with strict type checking
- Follow camelCase for variables/functions, PascalCase for types/classes
- Imports should use explicit names (no namespaced imports)
- Always use semicolons at the end of statements
- Use explicit equality operators (=== and !==)
- Use curly braces for all control structures
- ID validation: IDs must start with a letter, contain only letters, numbers, and underscores
- Error handling: Use try/catch with specific error types and display user-friendly messages
- File naming conventions: Use descriptive suffixes like `.location.ts`, `.event.ts`, etc.
- Use async/await for asynchronous code rather than callbacks or promise chains