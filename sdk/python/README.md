# VeilChain Python SDK

Official Python SDK for [VeilChain](https://veilchain.io) - the append-only Merkle tree ledger service.

## Installation

```bash
pip install veilchain
```

## Quick Start

```python
from veilchain import VeilChain

client = VeilChain(
    base_url='https://api.veilchain.io',
    api_key='vc_live_your_api_key'
)

# Create a ledger
ledger = client.create_ledger(
    name='audit-log',
    description='Application audit trail'
)

# Append an entry
result = client.append_entry(ledger.id, {
    'action': 'user_login',
    'user_id': 'user-123',
    'timestamp': '2024-01-15T10:30:00Z'
})

print('Entry ID:', result.entry.id)
print('Entry hash:', result.entry.hash)
print('New root:', result.new_root)

# Verify the entry is in the ledger
verified = client.verify_proof_local(result.proof)
print('Entry verified:', verified.valid)
```

## Features

- **Full type hints** with Pydantic models
- **Sync and async clients** for flexibility
- **Standalone verification** - verify proofs offline without network access
- **Automatic retries** with exponential backoff
- **JWT & API key authentication**

## API Reference

### Creating a Client

```python
from veilchain import VeilChain, AsyncVeilChain

# Sync client
client = VeilChain(
    base_url='https://api.veilchain.io',
    api_key='vc_live_...',        # API key authentication
    # OR
    token='eyJhbG...',            # JWT authentication
    timeout=30.0,                 # Request timeout (seconds)
    retries=3,                    # Retry attempts
)

# Async client
async_client = AsyncVeilChain(
    base_url='https://api.veilchain.io',
    api_key='vc_live_...'
)
```

### Context Manager

```python
# Sync
with VeilChain(base_url='...', api_key='...') as client:
    ledger = client.create_ledger(name='votes')

# Async
async with AsyncVeilChain(base_url='...', api_key='...') as client:
    ledger = await client.create_ledger(name='votes')
```

### Ledger Operations

```python
# Create a ledger
ledger = client.create_ledger(
    name='votes',
    description='Election votes',
    schema={'type': 'object'}  # Optional JSON Schema
)

# Get a ledger
ledger = client.get_ledger('ledger-id')

# List ledgers
result = client.list_ledgers(offset=0, limit=100)
for ledger in result.ledgers:
    print(ledger.name)

# Delete a ledger
client.delete_ledger('ledger-id')
```

### Entry Operations

```python
# Append an entry
result = client.append_entry('ledger-id', {
    'vote': 'yes',
    'voter': 'alice'
}, idempotency_key='vote-alice-2024')  # Prevent duplicates

print('Entry ID:', result.entry.id)
print('New root:', result.new_root)

# Get an entry with proof
entry = client.get_entry('ledger-id', 'entry-id', include_proof=True)

# List entries
result = client.list_entries('ledger-id', offset=0, limit=100)
for entry in result.entries:
    print(entry.data)
```

### Proof Verification

```python
# Get a proof
proof = client.get_proof('ledger-id', 'entry-id')

# Verify locally (offline, recommended)
result = client.verify_proof_local(proof)
print(result.valid)  # True

# Verify via API
result = client.verify_proof(proof)
```

### Public API (No Authentication)

```python
# Get public root (anyone can verify ledger state)
root = client.get_public_root('ledger-id')
print(root.root_hash)
print(root.entry_count)

# Get historical roots
history = client.get_public_roots('ledger-id', limit=10)
for root in history.roots:
    print(root.root_hash, root.timestamp)

# Verify proof publicly
result = client.verify_public(proof)
```

## Standalone Verification

For offline verification without the full client:

```python
from veilchain import (
    verify_proof,
    hash_data,
    verify_data_with_proof,
    MerkleProof
)

# Verify a proof
proof = MerkleProof(
    leaf='...',
    index=5,
    proof=['hash1', 'hash2'],
    directions=['left', 'right'],
    root='...'
)
result = verify_proof(proof)
if result.valid:
    print('Proof is valid!')

# Hash data the same way VeilChain does
hash_value = hash_data({'vote': 'yes'})

# Verify data matches proof and proof is valid
result = verify_data_with_proof({'vote': 'yes'}, proof)
print('Data matches:', result.data_match)
print('Proof valid:', result.valid)
```

## Compact Proofs

For efficient storage/transmission:

```python
from veilchain import to_compact_proof, parse_compact_proof, verify_proof

# Convert to compact format
compact = to_compact_proof(proof)
print(len(str(compact)))  # Much smaller!

# Store or transmit compact proof...

# Convert back and verify
full_proof = parse_compact_proof(compact)
result = verify_proof(full_proof)
```

## Async Usage

```python
import asyncio
from veilchain import AsyncVeilChain

async def main():
    async with AsyncVeilChain(
        base_url='https://api.veilchain.io',
        api_key='vc_live_...'
    ) as client:
        # Create ledger
        ledger = await client.create_ledger(name='async-votes')

        # Append entries concurrently
        results = await asyncio.gather(
            client.append_entry(ledger.id, {'vote': 'yes'}),
            client.append_entry(ledger.id, {'vote': 'no'}),
            client.append_entry(ledger.id, {'vote': 'yes'})
        )

        for result in results:
            print(f'Entry {result.entry.id}: {result.entry.data}')

asyncio.run(main())
```

## Error Handling

```python
from veilchain import VeilChain, VeilChainError

try:
    client.append_entry('ledger-id', data)
except VeilChainError as e:
    print('Status:', e.status)    # HTTP status code
    print('Code:', e.code)        # API error code
    print('Message:', e.message)  # Error message
    print('Details:', e.details)  # Additional details
```

## Type Hints

All types are fully typed with Pydantic models:

```python
from veilchain import (
    Ledger,
    LedgerEntry,
    MerkleProof,
    CompactProof,
    AppendEntryResult,
    VerifyProofResult,
)

def process_entry(entry: LedgerEntry) -> None:
    print(entry.id, entry.hash)
```

## License

MIT
