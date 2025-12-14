---
title: 'Quickstart - Build Immutable Audit Logs with Merkle Trees'
description: 'Create tamper-proof ledgers in 5 minutes. Learn merkle tree implementation for cryptographic audit logs and data integrity verification.'
weight: 1
css: ['docs.css']
---

Get started building immutable ledgers with merkle trees in under 5 minutes. This guide shows you how to create tamper-proof audit logs and generate cryptographic proofs for data integrity.

## Installation

Install VeilChain using npm:

```bash
npm install @veilchain/core
```

Or using Docker:

```bash
docker pull veilchain/server:latest
docker run -p 3000:3000 veilchain/server
```

## Basic Usage

### Creating an Immutable Merkle Tree Ledger

```typescript
import { MerkleTree, sha256 } from '@veilchain/core';

// Create a new merkle tree for immutable ledger
const tree = new MerkleTree();

// Append entries to tamper-proof audit log (immutable once added)
const position = tree.append(sha256('audit log entry 1'));
console.log(`Entry added at position ${position}`);

// Get the current merkle root hash for data integrity verification
console.log(`Root: ${tree.root}`);
```

### Generating Cryptographic Merkle Proofs

```typescript
// Generate merkle proof of inclusion for entry at index 0
const proof = tree.getProof(0);

// The merkle proof contains:
// - leaf: The hash of the entry
// - index: Position in the immutable ledger
// - proof: Array of sibling hashes for merkle tree verification
// - directions: Array of directions (left/right)
// - root: The merkle root hash at time of proof generation
```

### Verifying Merkle Proofs for Data Integrity

```typescript
// Verify the merkle proof (works offline, by anyone)
const isValid = MerkleTree.verify(proof);
console.log(`Proof is valid: ${isValid}`); // true

// For detailed verification results of tamper-proof data:
import { verifyProofDetailed } from '@veilchain/core';

const result = verifyProofDetailed(proof);
if (result.valid) {
  console.log(`Entry ${result.index} verified against merkle root ${result.root}`);
} else {
  console.error(`Verification failed: ${result.error}`);
}
```

## Using the REST API

If you're running VeilChain as a server:

### Create a Ledger

```bash
curl -X POST http://localhost:3000/api/v1/ledgers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"name": "audit-logs", "description": "Application audit trail"}'
```

### Append an Entry

```bash
curl -X POST http://localhost:3000/api/v1/ledgers/audit-logs/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"data": {"action": "user_login", "userId": "123"}}'
```

### Get a Proof

```bash
curl http://localhost:3000/api/v1/ledgers/audit-logs/proofs/0 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Next Steps

- [API Reference](/docs/api/) - Complete REST API documentation
- [SDK Guide](/docs/sdk/) - TypeScript SDK deep dive
- [Self-Hosting](/docs/deployment/) - Deploy VeilChain on your infrastructure
