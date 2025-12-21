# @veilchain/sdk

Official JavaScript/TypeScript SDK for [VeilChain](https://veilchain.io) - the append-only Merkle tree ledger service.

## Installation

```bash
npm install @veilchain/sdk
# or
yarn add @veilchain/sdk
# or
pnpm add @veilchain/sdk
```

## Quick Start

```typescript
import { VeilChain } from '@veilchain/sdk';

const client = new VeilChain({
  baseUrl: 'https://api.veilchain.io',
  apiKey: 'vc_live_your_api_key'
});

// Create a ledger
const ledger = await client.createLedger({
  name: 'audit-log',
  description: 'Application audit trail'
});

// Append an entry
const result = await client.appendEntry(ledger.id, {
  action: 'user_login',
  userId: 'user-123',
  timestamp: new Date().toISOString()
});

console.log('Entry ID:', result.entry.id);
console.log('Entry hash:', result.entry.hash);
console.log('New root:', result.newRoot);

// Verify the entry is in the ledger
const verified = await client.verifyProofLocal(result.proof);
console.log('Entry verified:', verified.valid);
```

## Features

- **Full TypeScript support** with complete type definitions
- **Browser & Node.js compatible** (ES Modules + CommonJS)
- **Standalone verification** - verify proofs offline without network access
- **Tree-shakeable** - only bundle what you use
- **Automatic retries** with exponential backoff
- **JWT & API key authentication**

## API Reference

### Creating a Client

```typescript
import { VeilChain } from '@veilchain/sdk';

const client = new VeilChain({
  baseUrl: 'https://api.veilchain.io',
  apiKey: 'vc_live_...',        // API key authentication
  // OR
  token: 'eyJhbG...',           // JWT authentication
  timeout: 30000,               // Request timeout (ms)
  retries: 3,                   // Retry attempts
});
```

### Ledger Operations

```typescript
// Create a ledger
const ledger = await client.createLedger({
  name: 'votes',
  description: 'Election votes',
  schema: { /* optional JSON Schema */ }
});

// Get a ledger
const ledger = await client.getLedger('ledger-id');

// List ledgers
const { ledgers, total } = await client.listLedgers({
  offset: 0,
  limit: 100
});

// Delete a ledger
await client.deleteLedger('ledger-id');
```

### Entry Operations

```typescript
// Append an entry
const result = await client.appendEntry('ledger-id', {
  vote: 'yes',
  voter: 'alice'
}, {
  idempotencyKey: 'vote-alice-2024'  // Prevent duplicates
});

// Get an entry with proof
const entry = await client.getEntry('ledger-id', 'entry-id', true);

// List entries
const { entries, total } = await client.listEntries('ledger-id', {
  offset: 0,
  limit: 100
});
```

### Proof Verification

```typescript
// Get a proof
const proof = await client.getProof('ledger-id', 'entry-id');

// Verify locally (offline, recommended)
const result = await client.verifyProofLocal(proof);

// Verify via API
const result = await client.verifyProof(proof);

console.log(result.valid);  // true
console.log(result.leaf);   // Entry hash
console.log(result.root);   // Merkle root
```

### Public API (No Authentication)

```typescript
// Get public root (anyone can verify ledger state)
const root = await client.getPublicRoot('ledger-id');
console.log(root.rootHash);
console.log(root.entryCount);

// Get historical roots
const history = await client.getPublicRoots('ledger-id', {
  limit: 10
});

// Verify proof publicly
const result = await client.verifyPublic(proof);
```

## Standalone Verification

For browser/offline verification without the full SDK:

```typescript
import { verifyProof, hashData, verifyDataWithProof } from '@veilchain/sdk/verify';

// Verify a proof
const result = await verifyProof(proof);
if (result.valid) {
  console.log('Proof is valid!');
}

// Hash data the same way VeilChain does
const hash = await hashData({ vote: 'yes' });

// Verify data matches proof and proof is valid
const result = await verifyDataWithProof(
  { vote: 'yes' },
  proof
);
console.log('Data matches:', result.dataMatch);
console.log('Proof valid:', result.valid);
```

## Compact Proofs

For efficient storage/transmission:

```typescript
import { toCompactProof, parseCompactProof, verifyProof } from '@veilchain/sdk/verify';

// Convert to compact format
const compact = toCompactProof(proof);
console.log(JSON.stringify(compact).length);  // Much smaller!

// Store or transmit compact proof...

// Convert back and verify
const fullProof = parseCompactProof(compact);
const result = await verifyProof(fullProof);
```

## Error Handling

```typescript
import { VeilChain, VeilChainError } from '@veilchain/sdk';

try {
  await client.appendEntry('ledger-id', data);
} catch (error) {
  if (error instanceof VeilChainError) {
    console.log('Status:', error.status);    // HTTP status code
    console.log('Code:', error.code);        // API error code
    console.log('Message:', error.message);  // Error message
    console.log('Details:', error.details);  // Additional details
  }
}
```

## TypeScript Support

All types are exported for your convenience:

```typescript
import type {
  Ledger,
  LedgerEntry,
  MerkleProof,
  CompactProof,
  VeilChainConfig,
  AppendEntryResult,
  VerifyProofResult,
} from '@veilchain/sdk';
```

## Browser Usage

The SDK works in modern browsers that support the Web Crypto API:

```html
<script type="module">
  import { VeilChain, verifyProof } from 'https://unpkg.com/@veilchain/sdk';

  const client = new VeilChain({
    baseUrl: 'https://api.veilchain.io',
    apiKey: 'your-api-key'
  });

  // Use the client...
</script>
```

## Node.js Usage

Works with Node.js 18+ (native fetch support):

```javascript
const { VeilChain } = require('@veilchain/sdk');

const client = new VeilChain({
  baseUrl: 'https://api.veilchain.io',
  apiKey: process.env.VEILCHAIN_API_KEY
});
```

For Node.js < 18, provide a fetch implementation:

```javascript
const fetch = require('node-fetch');

const client = new VeilChain({
  baseUrl: 'https://api.veilchain.io',
  apiKey: 'your-api-key',
  fetch: fetch
});
```

## License

MIT
