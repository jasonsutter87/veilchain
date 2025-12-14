---
title: 'API Reference'
description: 'Complete REST API documentation for VeilChain. Manage ledgers, append entries, and generate cryptographic proofs.'
weight: 2
css: ['docs.css']
---

## Overview

The VeilChain REST API provides programmatic access to create and manage tamper-proof ledgers. All endpoints return JSON and use standard HTTP response codes.

**Base URL:** `https://api.veilchain.io/v1` (or your self-hosted instance)

## Authentication

All API requests require a Bearer token:

```bash
Authorization: Bearer YOUR_API_KEY
```

## Ledgers

### List Ledgers

```http
GET /ledgers
```

Returns all ledgers accessible to your API key.

**Response:**
```json
{
  "ledgers": [
    {
      "id": "ldg_abc123",
      "name": "audit-logs",
      "description": "Application audit trail",
      "size": 1247,
      "root": "3a7f4c2b...",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:22:00Z"
    }
  ]
}
```

---

### Create Ledger

```http
POST /ledgers
```

**Request Body:**
```json
{
  "name": "audit-logs",
  "description": "Application audit trail"
}
```

**Response:** `201 Created`
```json
{
  "id": "ldg_abc123",
  "name": "audit-logs",
  "description": "Application audit trail",
  "size": 0,
  "root": "e3b0c442...",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### Get Ledger

```http
GET /ledgers/:id
```

Returns detailed information about a specific ledger.

**Response:**
```json
{
  "id": "ldg_abc123",
  "name": "audit-logs",
  "description": "Application audit trail",
  "size": 1247,
  "root": "3a7f4c2b...",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T14:22:00Z"
}
```

---

## Entries

### Append Entry

```http
POST /ledgers/:id/entries
```

Appends a new entry to the ledger. **This operation is immutable** - once an entry is added, it cannot be modified or deleted.

**Request Body:**
```json
{
  "data": {
    "action": "user_login",
    "userId": "user_123",
    "ip": "192.168.1.1",
    "timestamp": "2024-01-15T14:22:00Z"
  },
  "idempotencyKey": "req_unique_123"
}
```

**Response:** `201 Created`
```json
{
  "id": "ent_def456",
  "index": 1247,
  "hash": "9f86d081...",
  "root": "3a7f4c2b...",
  "createdAt": "2024-01-15T14:22:00Z"
}
```

**Headers:**
- `X-Idempotency-Key` - Optional. Prevents duplicate entries for the same request.

---

### Append Batch

```http
POST /ledgers/:id/entries/batch
```

Appends multiple entries atomically.

**Request Body:**
```json
{
  "entries": [
    { "data": { "action": "event_1" } },
    { "data": { "action": "event_2" } },
    { "data": { "action": "event_3" } }
  ]
}
```

**Response:** `201 Created`
```json
{
  "entries": [
    { "id": "ent_001", "index": 1247, "hash": "..." },
    { "id": "ent_002", "index": 1248, "hash": "..." },
    { "id": "ent_003", "index": 1249, "hash": "..." }
  ],
  "root": "3a7f4c2b...",
  "startIndex": 1247,
  "count": 3
}
```

---

### Get Entry

```http
GET /ledgers/:id/entries/:index
```

Retrieves an entry by its index.

**Response:**
```json
{
  "id": "ent_def456",
  "index": 1247,
  "hash": "9f86d081...",
  "data": {
    "action": "user_login",
    "userId": "user_123"
  },
  "createdAt": "2024-01-15T14:22:00Z"
}
```

---

## Proofs

### Get Inclusion Proof

```http
GET /ledgers/:id/proofs/:index
```

Generates a cryptographic proof that an entry exists in the ledger.

**Response:**
```json
{
  "leaf": "9f86d081...",
  "index": 1247,
  "proof": [
    "a1b2c3d4...",
    "e5f6g7h8...",
    "i9j0k1l2..."
  ],
  "directions": ["left", "right", "left"],
  "root": "3a7f4c2b...",
  "treeSize": 2048
}
```

---

### Verify Proof (Offline)

Proofs can be verified entirely offline using the SDK:

```typescript
import { MerkleTree, deserializeProof } from '@veilchain/core';

// Proof from API response
const serializedProof = { /* ... */ };

// Deserialize and verify
const proof = deserializeProof(serializedProof);
const isValid = MerkleTree.verify(proof);
```

---

## Consistency Proofs

### Get Consistency Proof

```http
GET /ledgers/:id/consistency?from=1000&to=2000
```

Proves that the ledger at size `from` is a prefix of the ledger at size `to`. Used for auditing.

**Response:**
```json
{
  "fromSize": 1000,
  "toSize": 2000,
  "fromRoot": "abc123...",
  "toRoot": "def456...",
  "proof": ["hash1...", "hash2...", "hash3..."]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "LEDGER_NOT_FOUND",
    "message": "Ledger with id 'ldg_xyz' not found",
    "details": {}
  }
}
```

**Common Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key lacks permission |
| `LEDGER_NOT_FOUND` | 404 | Ledger doesn't exist |
| `ENTRY_NOT_FOUND` | 404 | Entry index out of bounds |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Plan | Requests/min | Entries/day |
|------|-------------|-------------|
| Free | 60 | 1,000 |
| Pro | 600 | 100,000 |
| Enterprise | Unlimited | Unlimited |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705325520
```
