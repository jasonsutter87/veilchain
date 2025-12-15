# Installation Instructions for Validation System

## Quick Start

To install the new validation system dependencies and verify the build:

```bash
# 1. Install new dependencies
npm install

# 2. Build the project
npm run build

# 3. (Optional) Run tests if available
npm test
```

## What Was Added

### New Dependencies

The following packages were added to `package.json`:

- **ajv@^8.12.0** - JSON schema validation library
- **ajv-formats@^2.1.1** - Additional format validators (email, uri, date-time, etc.)

### New Files

1. **src/api/middleware/validation.ts** - Validation middleware and utilities
2. **VALIDATION.md** - Comprehensive validation documentation

### Modified Files

1. **src/api/types.ts** - Added validation config to ApiConfig
2. **src/api/server.ts** - Integrated validation into route registration
3. **src/api/routes/ledgers.ts** - Added ledger validation middleware
4. **src/api/routes/entries.ts** - Added entry size and schema validation
5. **src/types.ts** - Added schema field to LedgerMetadata
6. **package.json** - Added ajv dependencies

## Verification Steps

After running `npm install` and `npm run build`, verify:

### 1. Check Build Output

```bash
npm run build
```

Expected: No TypeScript compilation errors

### 2. Start the API Server

```bash
npm run start:api
```

Expected: Server starts without errors

### 3. Test Validation Endpoints

#### Test Size Limit Validation

```bash
# Try to create entry that's too large (should fail with 413)
curl -X POST http://localhost:3000/v1/ledgers/{ledger_id}/entries \
  -H "Content-Type: application/json" \
  -d '{"data": "'$(python3 -c 'print("x" * 2000000)')'"}'
```

#### Test Ledger Name Validation

```bash
# Invalid name (should fail with 400)
curl -X POST http://localhost:3000/v1/ledgers \
  -H "Content-Type: application/json" \
  -d '{"name": "invalid@name!"}'
```

#### Test Schema Validation

```bash
# Create ledger with schema
curl -X POST http://localhost:3000/v1/ledgers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Ledger",
    "schema": {
      "type": "object",
      "required": ["userId"],
      "properties": {
        "userId": {"type": "string"}
      }
    }
  }'

# Try to add invalid entry (should fail)
curl -X POST http://localhost:3000/v1/ledgers/{ledger_id}/entries \
  -H "Content-Type: application/json" \
  -d '{"data": {"wrongField": "value"}}'
```

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing types:

```bash
npm install --save-dev @types/node@latest
```

### AJV Import Errors

If you see module resolution errors:

1. Ensure `"type": "module"` is in package.json
2. Check that imports use `.js` extension: `from 'ajv'` (not `.ts`)
3. Verify tsconfig.json has `"moduleResolution": "node"`

### Runtime Errors

If the server fails to start:

1. Check that all imports are correct
2. Verify ajv and ajv-formats are in node_modules
3. Check console for specific error messages

## Configuration

Default validation limits are:

- Max entry size: 1MB
- Max ledger name: 255 characters
- Max description: 1000 characters
- Max batch payload: 10MB

To customize, update your server configuration:

```typescript
import { createServer } from './api/server.js';

const server = await createServer({
  validation: {
    maxEntrySize: 5 * 1024 * 1024,  // 5MB
    maxBatchSize: 50 * 1024 * 1024   // 50MB
  }
});
```

## Next Steps

1. Review VALIDATION.md for detailed documentation
2. Update any client code to handle validation errors
3. Consider adding schemas to your ledgers for data validation
4. Monitor validation error logs to tune size limits

## Support

For issues or questions:
- Check VALIDATION.md for usage examples
- Review error messages in server logs
- Check API responses for validation error details
