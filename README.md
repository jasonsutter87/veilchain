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

```bash
npm install @veilchain/core
```

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
