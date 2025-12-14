---
title: 'Quickstart Guide'
description: 'Get started with VeilChain in under 5 minutes. Learn how to create ledgers, append entries, and verify proofs.'
weight: 1
css: ['docs.css']
---

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

### Creating a Merkle Tree

```typescript
import { MerkleTree, sha256 } from '@veilchain/core';

// Create a new Merkle tree
const tree = new MerkleTree();

// Append entries (immutable once added)
const position = tree.append(sha256('audit log entry 1'));
console.log(`Entry added at position ${position}`);

// Get the current root hash
console.log(`Root: ${tree.root}`);
```

### Generating Proofs

```typescript
// Generate proof of inclusion for entry at index 0
const proof = tree.getProof(0);

// The proof contains:
// - leaf: The hash of the entry
// - index: Position in the tree
// - proof: Array of sibling hashes
// - directions: Array of directions (left/right)
// - root: The root hash at time of proof generation
```

### Verifying Proofs

```typescript
// Verify the proof (works offline, by anyone)
const isValid = MerkleTree.verify(proof);
console.log(`Proof is valid: ${isValid}`); // true

// For detailed verification results:
import { verifyProofDetailed } from '@veilchain/core';

const result = verifyProofDetailed(proof);
if (result.valid) {
  console.log(`Entry ${result.index} verified against root ${result.root}`);
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
