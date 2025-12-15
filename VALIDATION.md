# VeilChain Input Validation

This document describes the comprehensive input validation and size limit system implemented in the VeilChain API.

## Overview

The validation system provides:
- **Entry data size limits** - Prevent oversized payloads
- **Ledger name validation** - Enforce naming conventions
- **Description length limits** - Keep metadata concise
- **JSON schema validation** - Validate entry data structure
- **Batch size limits** - Control bulk operation payloads

## Configuration

Validation limits are configurable via the `ApiConfig.validation` property:

```typescript
import { createServer } from '@veilchain/core/api';

const server = await createServer({
  port: 3000,
  validation: {
    maxEntrySize: 1024 * 1024,         // 1MB (default)
    maxNameLength: 255,                 // 255 chars (default)
    maxDescriptionLength: 1000,         // 1000 chars (default)
    maxBatchSize: 10 * 1024 * 1024     // 10MB (default)
  }
});
```

### Default Limits

| Limit | Default Value | Description |
|-------|--------------|-------------|
| `maxEntrySize` | 1MB (1,048,576 bytes) | Maximum size for a single entry's data |
| `maxNameLength` | 255 characters | Maximum length for ledger names |
| `maxDescriptionLength` | 1000 characters | Maximum length for ledger descriptions |
| `maxBatchSize` | 10MB (10,485,760 bytes) | Maximum total size for batch append payloads |

## Validation Features

### 1. Ledger Name Validation

Ledger names must:
- Not be empty or whitespace only
- Not exceed `maxNameLength` characters (default: 255)
- Contain only alphanumeric characters, spaces, dashes, and underscores
- Match pattern: `/^[a-zA-Z0-9\s\-_]+$/`

**Example Error:**
```json
{
  "error": {
    "code": "INVALID_NAME",
    "message": "Ledger name can only contain alphanumeric characters, spaces, dashes, and underscores"
  }
}
```

### 2. Description Validation

Descriptions are optional but if provided:
- Cannot exceed `maxDescriptionLength` characters (default: 1000)

**Example Error:**
```json
{
  "error": {
    "code": "INVALID_DESCRIPTION",
    "message": "Description must not exceed 1000 characters (got 1523)"
  }
}
```

### 3. Entry Data Size Validation

Entry data is validated before processing:
- JSON serialized size cannot exceed `maxEntrySize` bytes (default: 1MB)
- Applies to both single append and batch append operations

**Example Error:**
```json
{
  "error": {
    "code": "ENTRY_TOO_LARGE",
    "message": "Entry data exceeds maximum size of 1048576 bytes (got 2097152 bytes)",
    "details": {
      "size": 2097152,
      "limit": 1048576
    }
  }
}
```

### 4. Batch Payload Size Validation

Batch operations validate the total payload size:
- Sum of all entry data sizes cannot exceed `maxBatchSize` bytes (default: 10MB)
- Individual entries also validated against `maxEntrySize`

**Example Error:**
```json
{
  "error": {
    "code": "BATCH_TOO_LARGE",
    "message": "Batch payload exceeds maximum size of 10485760 bytes (got 15728640 bytes)",
    "details": {
      "totalSize": 15728640,
      "limit": 10485760,
      "entryCount": 100
    }
  }
}
```

### 5. JSON Schema Validation

Ledgers can optionally define a JSON schema to validate entry data structure.

#### Creating a Ledger with Schema

```typescript
POST /v1/ledgers
{
  "name": "User Events",
  "description": "User activity tracking",
  "schema": {
    "type": "object",
    "required": ["userId", "eventType", "timestamp"],
    "properties": {
      "userId": { "type": "string", "pattern": "^[0-9a-f]{24}$" },
      "eventType": { "type": "string", "enum": ["login", "logout", "action"] },
      "timestamp": { "type": "string", "format": "date-time" },
      "metadata": { "type": "object" }
    },
    "additionalProperties": false
  }
}
```

#### Schema Validation on Entry Append

When appending entries to a ledger with a schema, the data is validated:

```typescript
POST /v1/ledgers/{ledgerId}/entries
{
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "eventType": "login",
    "timestamp": "2025-01-15T10:30:00Z",
    "metadata": { "ip": "192.168.1.1" }
  }
}
```

**Schema Validation Error:**
```json
{
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Entry data does not match ledger schema",
    "details": [
      {
        "instancePath": "/eventType",
        "schemaPath": "#/properties/eventType/enum",
        "keyword": "enum",
        "params": { "allowedValues": ["login", "logout", "action"] },
        "message": "must be equal to one of the allowed values"
      }
    ]
  }
}
```

## Using JSON Schema Features

The validation system uses [AJV](https://ajv.js.org/) for JSON schema validation with format validators enabled.

### Supported JSON Schema Features

- **Types**: string, number, integer, boolean, object, array, null
- **Validation Keywords**: required, properties, enum, pattern, minLength, maxLength, minimum, maximum, etc.
- **Formats**: date-time, email, uri, ipv4, ipv6, uuid, and more (via ajv-formats)
- **Advanced**: allOf, anyOf, oneOf, not, conditional schemas

### Example Schemas

#### Strict Vote Record
```json
{
  "type": "object",
  "required": ["voterId", "choice", "timestamp"],
  "properties": {
    "voterId": {
      "type": "string",
      "format": "uuid"
    },
    "choice": {
      "type": "string",
      "enum": ["yes", "no", "abstain"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

#### IoT Sensor Data
```json
{
  "type": "object",
  "required": ["deviceId", "measurements", "timestamp"],
  "properties": {
    "deviceId": {
      "type": "string",
      "pattern": "^SENSOR-[0-9]{6}$"
    },
    "measurements": {
      "type": "object",
      "properties": {
        "temperature": { "type": "number", "minimum": -40, "maximum": 125 },
        "humidity": { "type": "number", "minimum": 0, "maximum": 100 }
      }
    },
    "timestamp": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_NAME` | 400 | Ledger name validation failed |
| `INVALID_DESCRIPTION` | 400 | Description too long |
| `INVALID_FORMAT` | 400 | Invalid format (e.g., schema not an object) |
| `ENTRY_TOO_LARGE` | 413 | Single entry exceeds size limit |
| `BATCH_TOO_LARGE` | 413 | Batch payload exceeds size limit |
| `SCHEMA_VALIDATION_FAILED` | 400 | Entry data doesn't match ledger schema |

## Implementation Details

### Middleware Architecture

The validation system uses Fastify's `preValidation` hooks:

```typescript
// Entry size validation
fastify.post('/v1/ledgers/:id/entries', {
  preValidation: createEntrySizeValidator(validationConfig),
  // ... handler
});

// Batch size validation
fastify.post('/v1/ledgers/:id/entries/batch', {
  preValidation: createBatchSizeValidator(validationConfig),
  // ... handler
});

// Ledger creation validation
fastify.post('/v1/ledgers', {
  preValidation: createLedgerValidator(validationConfig),
  // ... handler
});
```

### Schema Caching

JSON schemas are compiled and cached for performance:
- Schemas are compiled once when first used
- Compiled validators are cached by ledger ID
- Cached validators are reused for all subsequent validations

## Best Practices

### 1. Set Appropriate Size Limits

Choose limits based on your use case:

```typescript
// High-volume, small entries (IoT, logs)
validation: {
  maxEntrySize: 10 * 1024,      // 10KB
  maxBatchSize: 1024 * 1024     // 1MB
}

// Document storage
validation: {
  maxEntrySize: 5 * 1024 * 1024,   // 5MB
  maxBatchSize: 50 * 1024 * 1024   // 50MB
}
```

### 2. Design Effective Schemas

- **Be specific**: Use `enum`, `pattern`, and format validators
- **Validate required fields**: Always specify `required` array
- **Use additionalProperties**: Set to `false` for strict validation
- **Document your schema**: Add `description` fields for clarity

### 3. Handle Validation Errors

```typescript
try {
  const response = await veilchain.append(ledgerId, {
    data: myData
  });
} catch (error) {
  if (error.code === 'SCHEMA_VALIDATION_FAILED') {
    console.error('Data validation failed:', error.details);
    // Transform data and retry
  } else if (error.code === 'ENTRY_TOO_LARGE') {
    console.error('Entry too large:', error.details);
    // Split or compress data
  }
}
```

### 4. Schema Evolution

Schemas are immutable once a ledger is created. For schema evolution:

1. **Create a new ledger** with the updated schema
2. **Migrate data** from old to new ledger if needed
3. **Version your ledgers** using naming conventions (e.g., `users-v1`, `users-v2`)

## Performance Considerations

### Size Calculation

- Entry size is calculated as JSON.stringify byte length
- Uses UTF-8 encoding for accurate byte count
- Minimal overhead (~1ms for 1MB entry)

### Schema Validation

- First validation per ledger: ~5-10ms (compilation)
- Subsequent validations: ~0.1-1ms (cached)
- Performance scales with schema complexity

## Security

### Input Sanitization

Validation provides the first line of defense:
- Prevents excessively large payloads (DoS protection)
- Enforces data structure (injection prevention)
- Validates data types (type safety)

### Recommendations

1. Always use schema validation for untrusted input
2. Set conservative size limits for public APIs
3. Use format validators for emails, URLs, UUIDs
4. Leverage `additionalProperties: false` to prevent data pollution

## Migration Guide

If upgrading from an earlier version without validation:

1. **Install dependencies**:
   ```bash
   npm install ajv@^8.12.0 ajv-formats@^2.1.1
   ```

2. **Update configuration** (optional):
   ```typescript
   const server = await createServer({
     validation: {
       maxEntrySize: 2 * 1024 * 1024  // Customize if needed
     }
   });
   ```

3. **Test existing integrations** - validation is enabled by default with generous limits

4. **Add schemas gradually** - schemas are optional and can be added ledger-by-ledger

## References

- [AJV Documentation](https://ajv.js.org/)
- [JSON Schema Specification](https://json-schema.org/)
- [AJV Formats](https://github.com/ajv-validator/ajv-formats)
