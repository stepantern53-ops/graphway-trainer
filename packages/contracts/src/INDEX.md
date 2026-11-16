# Contracts source

`index.ts` contains shared strict Zod request/response schemas, serializable DTO types, and no server-only behavior. Consumers are server and web; catalog DTO schemas use sparse `partialRecord` coefficient maps so each family includes only its own coefficients.
