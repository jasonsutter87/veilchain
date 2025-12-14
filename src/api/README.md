# VeilChain REST API

Production-ready REST API for the VeilChain Merkle tree ledger service.

## Quick Start

### Starting the Server

```bash
# Build the project
npm run build

# Start the API server
npm run start:api

# Or use environment variables
PORT=8080 API_KEY=your-secret-key npm run start:api
```

### Using Programmatically

```typescript
import { startServer } from '@veilchain/core/api';

const server = await startServer({
  port: 3000,
  host: '0.0.0.0',
  apiKey: 'your-secret-key',
  cors: true,
  logging: true
});
```

## Configuration

Configure the API using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to listen on | `3000` |
| `HOST` | Host to bind to | `0.0.0.0` |
| `API_KEY` | API key for authentication | None (auth disabled) |
| `CORS` | Enable CORS | `true` |
| `LOGGING` | Enable request logging | `true` |

## Endpoints

### Health Check

**GET** `/health`

Check server health and status.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 123.45,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "storage": {
    "status": "ok",
    "ledgers": 5,
    "totalEntries": 1000
  }
}
```

### Ledger Management

#### Create Ledger

**POST** `/v1/ledgers`

Create a new ledger.

**Request:**
```json
{
  "name": "audit-log",
  "description": "Company audit log",
  "schema": {
    "type": "object",
    "properties": {
      "action": { "type": "string" },
      "userId": { "type": "string" }
    }
  }
}
```

**Response:** (201 Created)
```json
{
  "id": "ledger_abc123",
  "name": "audit-log",
  "description": "Company audit log",
  "rootHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "entryCount": "0"
}
```

#### Get Ledger Metadata

**GET** `/v1/ledgers/:id`

Retrieve ledger metadata.

**Response:**
```json
{
  "id": "ledger_abc123",
  "name": "audit-log",
  "description": "Company audit log",
  "rootHash": "d3f2a1b...",
  "entryCount": "42",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastEntryAt": "2025-01-15T11:45:00.000Z"
}
```

#### Get Current Root Hash

**GET** `/v1/ledgers/:id/root`

Get the current root hash and entry count.

**Response:**
```json
{
  "rootHash": "d3f2a1b...",
  "entryCount": "42",
  "lastEntryAt": "2025-01-15T11:45:00.000Z"
}
```

### Entry Management

#### Append Entry

**POST** `/v1/ledgers/:id/entries`

Append a new entry to the ledger.

**Request:**
```json
{
  "data": {
    "action": "user_login",
    "userId": "user123",
    "timestamp": "2025-01-15T12:00:00.000Z"
  },
  "idempotencyKey": "optional-unique-key",
  "metadata": {
    "source": "auth-service"
  }
}
```

**Response:** (201 Created)
```json
{
  "entry": {
    "id": "ledger_abc123-0",
    "position": "0",
    "data": { ... },
    "hash": "a1b2c3d...",
    "createdAt": "2025-01-15T12:00:00.000Z"
  },
  "proof": {
    "leaf": "a1b2c3d...",
    "index": 0,
    "proof": ["sibling1", "sibling2"],
    "directions": ["right", "left"],
    "root": "d3f2a1b..."
  },
  "previousRoot": "e3b0c44...",
  "newRoot": "d3f2a1b..."
}
```

#### Get Entry

**GET** `/v1/ledgers/:id/entries/:eid?includeProof=true`

Retrieve a specific entry.

**Query Parameters:**
- `includeProof` - Include Merkle proof (default: false)

**Response:**
```json
{
  "id": "ledger_abc123-0",
  "position": "0",
  "data": { ... },
  "hash": "a1b2c3d...",
  "createdAt": "2025-01-15T12:00:00.000Z",
  "proof": { ... }
}
```

### Proof Management

#### Get Inclusion Proof

**GET** `/v1/ledgers/:id/proof/:eid`

Get the Merkle inclusion proof for an entry.

**Response:**
```json
{
  "proof": {
    "leaf": "a1b2c3d...",
    "index": 0,
    "proof": ["sibling1", "sibling2"],
    "directions": ["right", "left"],
    "root": "d3f2a1b..."
  },
  "entry": {
    "id": "ledger_abc123-0",
    "position": "0",
    "hash": "a1b2c3d..."
  }
}
```

#### Verify Proof (Stateless)

**POST** `/v1/verify`

Verify a Merkle proof without querying the ledger.

**Request:**
```json
{
  "proof": {
    "leaf": "a1b2c3d...",
    "index": 0,
    "proof": ["sibling1", "sibling2"],
    "directions": ["right", "left"],
    "root": "d3f2a1b..."
  }
}
```

**Response:**
```json
{
  "valid": true,
  "leaf": "a1b2c3d...",
  "root": "d3f2a1b...",
  "index": 0,
  "proofLength": 2
}
```

## Authentication

If `API_KEY` is configured, all endpoints (except `/health`) require authentication.

Include the API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your-secret-key" http://localhost:3000/v1/ledgers
```

## Rate Limiting

Default rate limits:
- Standard endpoints: 100 requests/minute
- Mutation endpoints: 10 requests/minute
- Health check: 1000 requests/minute

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid API key
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_ERROR` - Invalid request data
- `LEDGER_NOT_FOUND` - Ledger doesn't exist
- `ENTRY_NOT_FOUND` - Entry doesn't exist
- `INTERNAL_ERROR` - Server error

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **API Key Auth**: Simple authentication
- **Request Logging**: Audit trail
- **Input Validation**: JSON schema validation

## Examples

### Complete Workflow

```bash
# Create a ledger
LEDGER=$(curl -X POST http://localhost:3000/v1/ledgers \
  -H "Content-Type: application/json" \
  -d '{"name":"test-ledger"}' | jq -r '.id')

# Append an entry
curl -X POST http://localhost:3000/v1/ledgers/$LEDGER/entries \
  -H "Content-Type: application/json" \
  -d '{"data":{"message":"Hello VeilChain"}}'

# Get the entry with proof
curl "http://localhost:3000/v1/ledgers/$LEDGER/entries/${LEDGER}-0?includeProof=true"

# Verify the proof
curl -X POST http://localhost:3000/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"proof":{...}}'
```

## License

MIT - See LICENSE file for details
