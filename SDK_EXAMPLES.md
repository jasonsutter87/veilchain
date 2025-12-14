# VeilChain SDK Examples

Complete SDK for interacting with VeilChain Merkle tree ledger service.

## Installation

```bash
npm install @veilchain/core
```

## Quick Start

### Online Client Usage

```typescript
import { VeilChainClient } from '@veilchain/core';

// Initialize the client
const client = new VeilChainClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.veilchain.com'
});

// Create a ledger
const ledger = await client.createLedger({
  name: 'audit-log',
  description: 'System audit trail'
});

// Append entries
const entry = await client.append(ledger.id, {
  event: 'user_login',
  userId: 'alice@example.com',
  timestamp: new Date().toISOString()
});

console.log('Entry added at position:', entry.entry.position);
console.log('New root hash:', entry.newRoot);

// Get proof of inclusion
const proof = await client.getProof(ledger.id, entry.entry.id);
console.log('Merkle proof:', proof);
```

### Offline Proof Verification

Verify proofs without network access - perfect for air-gapped systems, auditors, and client-side validation:

```typescript
import { verifyProofOffline } from '@veilchain/core';

// Verify a proof (throws if invalid)
const isValid = verifyProofOffline(proof);
console.log('Proof is valid:', isValid);

// Verify with detailed results (doesn't throw)
import { verifyProofWithDetails } from '@veilchain/core';

const result = verifyProofWithDetails(proof);
if (!result.valid) {
  console.error('Verification failed:', result.error);
} else {
  console.log('Verified entry at index:', result.index);
  console.log('Proof length:', result.proofLength);
}
```

### Sharing Proofs

```typescript
import {
  encodeProofToString,
  decodeProofFromString,
  verifyEncodedProof
} from '@veilchain/core';

// Encode proof as base64 string (for QR codes, URLs, etc.)
const encodedProof = encodeProofToString(proof);
console.log('Encoded proof:', encodedProof);

// Decode and verify
const decodedProof = decodeProofFromString(encodedProof);
const isValid = verifyEncodedProof(encodedProof);
console.log('Proof valid:', isValid);
```

### Batch Operations

```typescript
// Batch verify multiple proofs
import { verifyProofsBatch, verifyProofsConsistency } from '@veilchain/core';

const results = verifyProofsBatch([proof1, proof2, proof3]);
console.log('All valid:', results.every(r => r.valid));

// Check if all proofs are from the same tree
const isConsistent = verifyProofsConsistency([proof1, proof2, proof3]);
console.log('Proofs consistent:', isConsistent);
```

## Advanced Features

### Custom Configuration

```typescript
const client = new VeilChainClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.veilchain.com',
  timeout: 30000,        // Request timeout in ms
  maxRetries: 3,         // Max retry attempts
  retryDelay: 1000,      // Initial retry delay in ms
  headers: {             // Custom headers
    'X-Custom-Header': 'value'
  }
});
```

### Error Handling

```typescript
import {
  VeilChainError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError
} from '@veilchain/core';

try {
  const ledger = await client.createLedger({ name: '' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.field);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.statusCode);
  }
}
```

### Listing and Pagination

```typescript
// List ledgers
const ledgers = await client.listLedgers({
  offset: 0,
  limit: 10
});

console.log('Total ledgers:', ledgers.total);
console.log('Ledgers:', ledgers.ledgers);

// List entries
const entries = await client.listEntries(ledger.id, {
  offset: 0,
  limit: 50
});

console.log('Total entries:', entries.total);
```

### Proof Metadata

```typescript
import { getProofMetadata } from '@veilchain/core';

const metadata = getProofMetadata(proof);
console.log('Entry index:', metadata.index);
console.log('Tree depth:', metadata.treeDepth);
console.log('Leaf hash:', metadata.leafHash);
console.log('Root hash:', metadata.rootHash);
```

### Proof Serialization

```typescript
import {
  serializeProofForStorage,
  deserializeProofFromStorage
} from '@veilchain/core';

// Compact serialization for database storage
const serialized = serializeProofForStorage(proof);
// { v: 1, l: '0x...', i: 5, p: [...], d: [0, 1], r: '0x...' }

// Store in database
await db.proofs.insert(serialized);

// Retrieve and deserialize
const stored = await db.proofs.findOne({ id: 'proof-123' });
const proof = deserializeProofFromStorage(stored);
const isValid = verifyProofOffline(proof);
```

## Use Cases

### 1. Audit Logging
```typescript
// Log every system action
const logEntry = await client.append(auditLedger.id, {
  action: 'delete_user',
  actor: 'admin@example.com',
  target: 'user-123',
  timestamp: Date.now()
});

// Provide proof to auditors
const proof = await client.getProof(auditLedger.id, logEntry.entry.id);
const encodedProof = encodeProofToString(proof);
// Auditors can verify offline without API access
```

### 2. Document Timestamping
```typescript
// Timestamp a document
const documentHash = sha256(documentContent);
const entry = await client.append(timestampLedger.id, {
  documentHash,
  title: 'Contract Agreement',
  timestamp: new Date().toISOString()
});

// Anyone can verify the document existed at this time
const proof = await client.getProof(timestampLedger.id, entry.entry.id);
```

### 3. Supply Chain Tracking
```typescript
// Track product journey
const shipment = await client.append(supplyChainLedger.id, {
  product: 'Widget-A',
  location: 'Warehouse B',
  status: 'shipped',
  carrier: 'FedEx',
  trackingNumber: '123456789'
});

// Customers can verify authenticity
const proof = await client.getProof(supplyChainLedger.id, shipment.entry.id);
```

## API Reference

See [API Documentation](./docs/API.md) for complete API reference.

## Testing

All SDK functionality is thoroughly tested:
- 44 passing tests
- 100% coverage of error scenarios
- Network retry logic
- Offline verification
- Proof serialization/deserialization

## Support

- GitHub Issues: https://github.com/jasonsutter87/veilchain
- Documentation: https://docs.veilchain.com
- Email: support@veilchain.com
