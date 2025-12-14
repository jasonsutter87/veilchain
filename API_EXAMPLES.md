# VeilChain API Examples

Complete examples for using the VeilChain REST API.

## Table of Contents

- [Authentication](#authentication)
- [Ledger Management](#ledger-management)
- [Entry Operations](#entry-operations)
- [Proof Generation & Verification](#proof-generation--verification)
- [Health Check](#health-check)

## Authentication

All API requests require an API key passed in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

## Base URL

```
https://api.veilchain.com/v1
```

For local development:
```
http://localhost:3000/v1
```

---

## Ledger Management

### Create a New Ledger

Create a new append-only ledger for storing entries.

**Endpoint:** `POST /v1/ledgers`

**Request:**
```bash
curl -X POST https://api.veilchain.com/v1/ledgers \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "audit-log",
    "description": "Application audit trail"
  }'
```

**Response:**
```json
{
  "id": "ledger_abc123",
  "name": "audit-log",
  "description": "Application audit trail",
  "rootHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "entryCount": "0",
  "createdAt": "2025-12-14T10:30:00.000Z"
}
```

### Get Ledger Information

Retrieve metadata about a specific ledger.

**Endpoint:** `GET /v1/ledgers/:ledgerId`

**Request:**
```bash
curl https://api.veilchain.com/v1/ledgers/ledger_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "id": "ledger_abc123",
  "name": "audit-log",
  "description": "Application audit trail",
  "rootHash": "a1b2c3d4e5f6...",
  "entryCount": "42",
  "createdAt": "2025-12-14T10:30:00.000Z",
  "lastEntryAt": "2025-12-14T11:45:00.000Z"
}
```

### List All Ledgers

Get a paginated list of all ledgers.

**Endpoint:** `GET /v1/ledgers`

**Query Parameters:**
- `offset` (optional): Number of ledgers to skip (default: 0)
- `limit` (optional): Maximum number of ledgers to return (default: 100, max: 1000)

**Request:**
```bash
curl "https://api.veilchain.com/v1/ledgers?offset=0&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "ledgers": [
    {
      "id": "ledger_abc123",
      "name": "audit-log",
      "description": "Application audit trail",
      "rootHash": "a1b2c3d4e5f6...",
      "entryCount": "42",
      "createdAt": "2025-12-14T10:30:00.000Z",
      "lastEntryAt": "2025-12-14T11:45:00.000Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 10
}
```

### Get Current Root Hash

Get the current Merkle root hash for a ledger.

**Endpoint:** `GET /v1/ledgers/:ledgerId/root`

**Request:**
```bash
curl https://api.veilchain.com/v1/ledgers/ledger_abc123/root \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "rootHash": "a1b2c3d4e5f6789...",
  "entryCount": "42",
  "lastEntryAt": "2025-12-14T11:45:00.000Z"
}
```

---

## Entry Operations

### Append an Entry

Add a new entry to a ledger. Entries are immutable once added.

**Endpoint:** `POST /v1/ledgers/:ledgerId/entries`

**Request:**
```bash
curl -X POST https://api.veilchain.com/v1/ledgers/ledger_abc123/entries \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "user": "alice@example.com",
      "action": "login",
      "ip": "192.168.1.1",
      "timestamp": "2025-12-14T12:00:00Z"
    },
    "idempotencyKey": "unique-key-123"
  }'
```

**Response:**
```json
{
  "entry": {
    "id": "ledger_abc123-42",
    "position": "42",
    "data": {
      "user": "alice@example.com",
      "action": "login",
      "ip": "192.168.1.1",
      "timestamp": "2025-12-14T12:00:00Z"
    },
    "hash": "7d8e9f0a1b2c3d4e...",
    "createdAt": "2025-12-14T12:00:01.000Z"
  },
  "proof": {
    "leaf": "7d8e9f0a1b2c3d4e...",
    "index": 42,
    "proof": ["sibling1...", "sibling2..."],
    "directions": ["left", "right"],
    "root": "a1b2c3d4e5f6..."
  },
  "previousRoot": "old_root_hash...",
  "newRoot": "a1b2c3d4e5f6..."
}
```

### Get an Entry

Retrieve a specific entry by ID.

**Endpoint:** `GET /v1/ledgers/:ledgerId/entries/:entryId`

**Query Parameters:**
- `includeProof` (optional): Include Merkle proof in response (default: false)

**Request:**
```bash
curl "https://api.veilchain.com/v1/ledgers/ledger_abc123/entries/ledger_abc123-42?includeProof=true" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "id": "ledger_abc123-42",
  "position": "42",
  "data": {
    "user": "alice@example.com",
    "action": "login"
  },
  "hash": "7d8e9f0a1b2c3d4e...",
  "createdAt": "2025-12-14T12:00:01.000Z",
  "proof": {
    "leaf": "7d8e9f0a1b2c3d4e...",
    "index": 42,
    "proof": ["sibling1...", "sibling2..."],
    "directions": ["left", "right"],
    "root": "a1b2c3d4e5f6..."
  }
}
```

### List Entries

Get a paginated list of entries in a ledger.

**Endpoint:** `GET /v1/ledgers/:ledgerId/entries`

**Query Parameters:**
- `offset` (optional): Position to start from (default: 0)
- `limit` (optional): Maximum entries to return (default: 100, max: 1000)

**Request:**
```bash
curl "https://api.veilchain.com/v1/ledgers/ledger_abc123/entries?offset=0&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "entries": [
    {
      "id": "ledger_abc123-0",
      "position": "0",
      "data": { "action": "create_ledger" },
      "hash": "1a2b3c4d...",
      "createdAt": "2025-12-14T10:30:00.000Z"
    },
    {
      "id": "ledger_abc123-1",
      "position": "1",
      "data": { "action": "first_entry" },
      "hash": "5e6f7g8h...",
      "createdAt": "2025-12-14T10:31:00.000Z"
    }
  ],
  "total": "42",
  "offset": "0",
  "limit": 10
}
```

---

## Proof Generation & Verification

### Get Proof for an Entry

Generate a Merkle proof of inclusion for a specific entry.

**Endpoint:** `GET /v1/ledgers/:ledgerId/proof/:entryId`

**Request:**
```bash
curl https://api.veilchain.com/v1/ledgers/ledger_abc123/proof/ledger_abc123-42 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "proof": {
    "leaf": "7d8e9f0a1b2c3d4e...",
    "index": 42,
    "proof": [
      "sibling1_hash...",
      "sibling2_hash...",
      "sibling3_hash..."
    ],
    "directions": ["left", "right", "left"],
    "root": "a1b2c3d4e5f6..."
  },
  "entry": {
    "id": "ledger_abc123-42",
    "position": "42",
    "hash": "7d8e9f0a1b2c3d4e..."
  }
}
```

### Verify a Proof (Stateless)

Verify a Merkle proof without accessing the ledger. This endpoint is stateless and can verify any proof.

**Endpoint:** `POST /v1/verify`

**Request:**
```bash
curl -X POST https://api.veilchain.com/v1/verify \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "proof": {
      "leaf": "7d8e9f0a1b2c3d4e...",
      "index": 42,
      "proof": ["sibling1...", "sibling2..."],
      "directions": ["left", "right"],
      "root": "a1b2c3d4e5f6..."
    }
  }'
```

**Response (Valid):**
```json
{
  "valid": true,
  "leaf": "7d8e9f0a1b2c3d4e...",
  "root": "a1b2c3d4e5f6...",
  "index": 42,
  "proofLength": 6
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "leaf": "7d8e9f0a1b2c3d4e...",
  "root": "a1b2c3d4e5f6...",
  "index": 42,
  "proofLength": 6,
  "error": "Proof verification failed - computed root does not match provided root"
}
```

---

## Health Check

Check the API server health status.

**Endpoint:** `GET /health`

**Request:**
```bash
curl https://api.veilchain.com/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600.5,
  "timestamp": "2025-12-14T12:00:00.000Z",
  "storage": {
    "status": "ok",
    "ledgers": 10,
    "totalEntries": 1234
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_DATA` | 400 | Entry data is invalid |
| `INVALID_PROOF` | 400 | Proof structure is invalid |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `LEDGER_NOT_FOUND` | 404 | Ledger does not exist |
| `ENTRY_NOT_FOUND` | 404 | Entry does not exist |
| `PROOF_NOT_FOUND` | 404 | Proof cannot be generated |
| `DUPLICATE_ENTRY` | 409 | Idempotency key already used |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

API rate limits by tier:

| Tier | Requests/min | Burst |
|------|--------------|-------|
| Free | 60 | 10 |
| Standard | 600 | 100 |
| Pro | 6000 | 1000 |

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1702555200
```

---

## SDK Usage

For easier integration, use the official SDK:

### JavaScript/TypeScript

```typescript
import { VeilChainClient } from '@veilchain/core';

const client = new VeilChainClient({
  baseUrl: 'https://api.veilchain.com',
  apiKey: 'your-api-key'
});

// Create a ledger
const ledger = await client.createLedger({
  name: 'audit-log',
  description: 'Application audit trail'
});

// Append an entry
const result = await client.append(ledger.id, {
  user: 'alice@example.com',
  action: 'login'
});

// Get proof
const proof = await client.getProof(ledger.id, result.entry.id);

// Verify offline
import { MerkleTree } from '@veilchain/core';
const isValid = MerkleTree.verify(proof);
```

---

## Best Practices

### 1. Use Idempotency Keys

Always use idempotency keys when appending entries to prevent duplicates:

```json
{
  "data": { "action": "payment" },
  "idempotencyKey": "payment-uuid-123"
}
```

### 2. Store Proofs Externally

Save proofs alongside your data for independent verification:

```typescript
const result = await client.append(ledgerId, data);
await saveToDatabase({
  data: data,
  proof: result.proof,
  entryId: result.entry.id
});
```

### 3. Verify Proofs Offline

You can verify proofs without API access:

```typescript
import { MerkleTree } from '@veilchain/core';

// Load proof from storage
const storedProof = loadProofFromDatabase();

// Verify without network call
const isValid = MerkleTree.verify(storedProof);
```

### 4. Batch Operations

For bulk operations, collect entries and append in batches to reduce API calls.

### 5. Monitor Root Hash

Periodically check and record the root hash for consistency:

```typescript
const { rootHash } = await client.getRootHash(ledgerId);
await archiveRootHash(ledgerId, rootHash, Date.now());
```

---

## Support

- Documentation: https://docs.veilchain.com
- GitHub: https://github.com/jasonsutter87/veilchain
- Email: support@veilchain.com
