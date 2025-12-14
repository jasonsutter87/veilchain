# VeilChain

**Bitcoin-grade immutability without the blockchain baggage.**

VeilChain is a Merkle tree ledger service that provides cryptographically verifiable, append-only data storage. Perfect for audit logs, compliance records, and any application requiring tamper-evident data.

## Features

- **Append-Only**: Data can never be modified or deleted
- **Cryptographic Proofs**: O(log n) inclusion proofs for any entry
- **External Anchoring**: Publish root hashes to Bitcoin, Ethereum, or public logs
- **Self-Hostable**: Run on your own infrastructure with Docker
- **No Blockchain Overhead**: No tokens, mining, or consensus delays

## Quick Start

### Installation

```bash
npm install @veilchain/core
```

### Basic Usage (Core Library)

```typescript
import { MerkleTree, sha256 } from '@veilchain/core';

// Create a new tree
const tree = new MerkleTree();

// Append entries
tree.append(sha256('audit log entry 1'));
tree.append(sha256('audit log entry 2'));

// Generate proof of inclusion
const proof = tree.getProof(0);

// Verify proof (can be done offline, by anyone)
const isValid = MerkleTree.verify(proof);
console.log(isValid); // true

// Get current root hash (publish this for external verification)
console.log(tree.root);
```

### Using the SDK (Recommended)

```typescript
import { VeilChainClient } from '@veilchain/core';

const client = new VeilChainClient({
  baseUrl: 'https://api.veilchain.com',
  apiKey: process.env.VEILCHAIN_API_KEY
});

// Create a ledger
const ledger = await client.createLedger({
  name: 'audit-log',
  description: 'Application audit trail'
});

// Append an entry with automatic proof generation
const result = await client.append(ledger.id, {
  user: 'alice@example.com',
  action: 'login',
  timestamp: new Date().toISOString()
});

console.log('Entry ID:', result.entry.id);
console.log('Proof:', result.proof);
console.log('New Root:', result.newRoot);

// Get entries
const entries = await client.listEntries(ledger.id, { limit: 10 });

// Verify proof offline (no API call needed)
import { MerkleTree } from '@veilchain/core';
const isValid = MerkleTree.verify(result.proof);
```

### Running the API Server

```bash
# Using Docker (recommended)
cd docker && docker-compose up -d

# Or run locally
npm run build
npm run start:api
```

## Documentation

- [API Reference](./API_EXAMPLES.md) - Complete REST API documentation with examples
- [SDK Examples](./SDK_EXAMPLES.md) - Client SDK usage patterns
- [Architecture Overview](./OVERVIEW.md) - System design and architecture
- [Roadmap](./ROADMAP.md) - Future features and milestones

## Use Cases

- **Audit Logs**: SOC2, HIPAA, SOX compliance
- **Document Notarization**: Prove documents existed at a point in time
- **Supply Chain**: Track provenance with tamper-evident records
- **Regulatory Filings**: Prove what was filed and when
- **Evidence Chain of Custody**: Legal admissibility

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Start development (with Docker)
cd docker && docker-compose up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VEILCHAIN ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client SDK                                                      │
│  ├── Append entries                                             │
│  ├── Generate proofs                                            │
│  └── Verify proofs (offline capable)                            │
│                                                                  │
│  API Layer                                                       │
│  ├── REST endpoints                                             │
│  ├── Rate limiting                                              │
│  └── Idempotency                                                │
│                                                                  │
│  Storage Layer                                                   │
│  ├── PostgreSQL (append-only enforced)                          │
│  ├── Redis (caching)                                            │
│  └── In-memory (development)                                    │
│                                                                  │
│  Anchoring Layer                                                 │
│  ├── Bitcoin (OP_RETURN)                                        │
│  ├── Ethereum (optional)                                        │
│  └── Public transparency logs                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## License

MIT

## Author

Jason Sutter ([@jasonsutter87](https://github.com/jasonsutter87))
