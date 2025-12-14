---
title: 'Introducing VeilChain: Bitcoin-grade Immutability Without the Blockchain'
description: 'Today we are launching VeilChain, an open-source Merkle tree ledger service that provides cryptographic data integrity without the complexity of blockchain.'
date: 2024-12-14T10:00:00Z
author: 'VeilChain Team'
tags: ['announcement', 'launch', 'merkle-trees']
draft: false
css: ['blog.css']
---

We're excited to announce the launch of VeilChain, an open-source Merkle tree ledger service designed to bring Bitcoin-grade data immutability to your applications without the overhead of running a full blockchain.

## The Problem

Modern applications need verifiable data integrity. Whether you're building audit logs for compliance, document notarization systems, or supply chain tracking, you need to prove that data hasn't been tampered with.

Blockchain seems like the obvious solution, but it comes with significant downsides:

- **Consensus overhead** - Mining or staking delays every write operation
- **Token economics** - Gas fees and cryptocurrency complexity
- **Scaling challenges** - Limited throughput and storage costs
- **Operational burden** - Node management and network participation

## The VeilChain Approach

VeilChain strips away the blockchain complexity while keeping the cryptographic guarantees. At its core, VeilChain is a Merkle tree - the same data structure that powers Bitcoin's transaction verification.

### How It Works

1. **Append entries** - Hash your data and add it to the tree. Each entry is immutable once added.

2. **Generate proofs** - Get compact O(log n) proofs that any entry exists in the ledger.

3. **Verify anywhere** - Proofs can be verified offline, by anyone, without needing to trust VeilChain.

4. **Anchor externally** - Publish your root hash to Bitcoin, Ethereum, or public transparency logs for ultimate verification.

## Use Cases

VeilChain is perfect for:

- **Audit Logs** - SOC2, HIPAA, and SOX compliant tamper-proof audit trails
- **Document Notarization** - Prove documents existed at a specific point in time
- **Supply Chain** - Track provenance with verifiable chain of custody
- **Legal Evidence** - Court-admissible proof of data integrity
- **Regulatory Filing** - Prove what was filed and when for compliance

## Getting Started

Install the SDK:

```bash
npm install @veilchain/core
```

Create your first immutable ledger:

```typescript
import { MerkleTree, sha256 } from '@veilchain/core';

const tree = new MerkleTree();
tree.append(sha256('My first audit log entry'));

console.log(`Root: ${tree.root}`);
```

## Open Source

VeilChain is fully open source under the MIT license. Self-host it with Docker, embed it in your applications, or use our managed API.

[Get started with the documentation](/docs/quickstart/) or [view the source on GitHub](https://github.com/jasonsutter87/veilchain).

---

We're just getting started. Follow our blog for updates on new features, integration guides, and deep dives into the cryptography behind VeilChain.
