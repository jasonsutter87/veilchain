/**
 * Integration Scenarios Tests
 *
 * End-to-end integration tests for common usage patterns.
 */

import { MerkleTree } from '../src/core/merkle';
import { sha256, isValidHash } from '../src/core/hash';

describe('Integration Scenarios Tests', () => {
  describe('Voting System Scenario', () => {
    it('should record and verify votes', () => {
      const tree = new MerkleTree();
      const votes = [
        { voter: 'voter1', choice: 'A' },
        { voter: 'voter2', choice: 'B' },
        { voter: 'voter3', choice: 'A' },
      ];

      const indices = votes.map(v =>
        tree.append(sha256(JSON.stringify(v)))
      );

      // All votes recorded
      expect(tree.size).toBe(3);

      // Each vote verifiable
      for (const idx of indices) {
        expect(MerkleTree.verify(tree.getProof(idx)!)).toBe(true);
      }
    });

    it('should detect vote tampering', () => {
      const tree = new MerkleTree();
      const originalVote = { voter: 'voter1', choice: 'A' };
      tree.append(sha256(JSON.stringify(originalVote)));

      const proof = tree.getProof(0)!;

      // Tampered vote
      const tamperedVote = { voter: 'voter1', choice: 'B' };
      const tamperedProof = {
        ...proof,
        leaf: sha256(JSON.stringify(tamperedVote))
      };

      expect(MerkleTree.verify(tamperedProof)).toBe(false);
    });

    it('should track vote history with root', () => {
      const tree = new MerkleTree();
      const snapshots: string[] = [];

      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`vote-${i}`));
        snapshots.push(tree.root);
      }

      // Each snapshot is unique
      expect(new Set(snapshots).size).toBe(10);
    });

    it('should support vote count verification', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`vote-${i}`));
      }
      expect(tree.size).toBe(100);
      expect(tree.getLeaves().length).toBe(100);
    });
  });

  describe('Document Audit Trail Scenario', () => {
    it('should track document versions', () => {
      const tree = new MerkleTree();
      const versions = [
        { version: 1, content: 'Draft' },
        { version: 2, content: 'Review' },
        { version: 3, content: 'Final' },
      ];

      versions.forEach(v => tree.append(sha256(JSON.stringify(v))));

      expect(tree.size).toBe(3);

      // All versions verifiable
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should prove document existed at time', () => {
      const tree = new MerkleTree();
      const doc = { id: 'doc-123', timestamp: Date.now(), content: 'Important' };
      const idx = tree.append(sha256(JSON.stringify(doc)));

      const proof = tree.getProof(idx)!;
      expect(proof.root).toBe(tree.root);
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should maintain audit trail integrity', () => {
      const tree = new MerkleTree();
      const events = [];

      for (let i = 0; i < 50; i++) {
        const event = {
          type: 'access',
          user: `user${i % 10}`,
          timestamp: Date.now() + i,
          action: 'view'
        };
        events.push(event);
        tree.append(sha256(JSON.stringify(event)));
      }

      expect(tree.size).toBe(50);

      // Any event can be proven
      const proof = tree.getProof(25)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });
  });

  describe('Supply Chain Scenario', () => {
    it('should track item journey', () => {
      const tree = new MerkleTree();
      const journey = [
        { location: 'Factory', timestamp: 1 },
        { location: 'Warehouse', timestamp: 2 },
        { location: 'Distribution', timestamp: 3 },
        { location: 'Store', timestamp: 4 },
      ];

      journey.forEach(j => tree.append(sha256(JSON.stringify(j))));

      // Full journey verifiable
      for (let i = 0; i < journey.length; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify item authenticity', () => {
      const tree = new MerkleTree();
      const item = {
        serialNumber: 'SN-12345',
        manufacturer: 'Acme Corp',
        productionDate: '2024-01-15'
      };

      tree.append(sha256(JSON.stringify(item)));
      const proof = tree.getProof(0)!;

      // Authentic item verifies
      expect(MerkleTree.verify(proof)).toBe(true);

      // Counterfeit fails
      const counterfeit = { ...item, manufacturer: 'Fake Corp' };
      expect(MerkleTree.verify({
        ...proof,
        leaf: sha256(JSON.stringify(counterfeit))
      })).toBe(false);
    });
  });

  describe('Certificate Issuance Scenario', () => {
    it('should issue and verify certificates', () => {
      const tree = new MerkleTree();
      const certs = [];

      for (let i = 0; i < 20; i++) {
        const cert = {
          id: `CERT-${i.toString().padStart(4, '0')}`,
          holder: `Student ${i}`,
          course: 'Blockchain 101',
          date: '2024-06-01'
        };
        certs.push(cert);
        tree.append(sha256(JSON.stringify(cert)));
      }

      // Any certificate verifiable
      for (let i = 0; i < 20; i++) {
        const proof = tree.getProof(i)!;
        expect(proof.leaf).toBe(sha256(JSON.stringify(certs[i])));
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });

    it('should detect forged certificates', () => {
      const tree = new MerkleTree();
      const realCert = {
        id: 'CERT-0001',
        holder: 'Alice',
        course: 'Blockchain 101'
      };

      tree.append(sha256(JSON.stringify(realCert)));
      const proof = tree.getProof(0)!;

      const forgedCert = {
        id: 'CERT-0001',
        holder: 'Bob', // Different holder
        course: 'Blockchain 101'
      };

      expect(MerkleTree.verify({
        ...proof,
        leaf: sha256(JSON.stringify(forgedCert))
      })).toBe(false);
    });
  });

  describe('Timestamping Service Scenario', () => {
    it('should timestamp documents', () => {
      const tree = new MerkleTree();
      const docs = [];

      for (let i = 0; i < 100; i++) {
        const doc = {
          hash: sha256(`document-content-${i}`),
          timestamp: Date.now() + i
        };
        docs.push(doc);
        tree.append(sha256(JSON.stringify(doc)));
      }

      expect(tree.size).toBe(100);

      // Random document proof
      const proof = tree.getProof(50)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should provide compact proofs', () => {
      const tree = new MerkleTree();
      for (let i = 0; i < 1000; i++) {
        tree.append(sha256(`doc-${i}`));
      }

      // Proof size is logarithmic
      const proof = tree.getProof(500)!;
      expect(proof.proof.length).toBeLessThanOrEqual(10); // log2(1000) ≈ 10
    });
  });

  describe('Membership Registry Scenario', () => {
    it('should track member registrations', () => {
      const tree = new MerkleTree();
      const members = [];

      for (let i = 0; i < 50; i++) {
        const member = {
          id: i,
          email: `member${i}@example.com`,
          joinDate: '2024-01-01'
        };
        members.push(member);
        tree.append(sha256(JSON.stringify(member)));
      }

      // Verify specific member
      const memberIdx = 25;
      const proof = tree.getProof(memberIdx)!;
      expect(proof.leaf).toBe(sha256(JSON.stringify(members[memberIdx])));
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should prove non-membership via absence', () => {
      const tree = new MerkleTree();
      const registeredEmails = ['a@test.com', 'b@test.com', 'c@test.com'];

      registeredEmails.forEach(email =>
        tree.append(sha256(email))
      );

      const unregisteredHash = sha256('unknown@test.com');
      const leaves = tree.getLeaves();

      // Not in the tree
      expect(leaves).not.toContain(unregisteredHash);
    });
  });

  describe('Multi-Party Computation Scenario', () => {
    it('should commit values before reveal', () => {
      const tree = new MerkleTree();
      const commitments = [];

      // Each party commits a secret
      for (let i = 0; i < 5; i++) {
        const secret = `party${i}-secret-${Math.random()}`;
        const commitment = sha256(secret);
        commitments.push({ secret, commitment });
        tree.append(commitment);
      }

      // Commitments are locked
      const _commitRoot = tree.root;

      // Later: verify revealed values match commitments
      for (let i = 0; i < 5; i++) {
        const proof = tree.getProof(i)!;
        expect(proof.leaf).toBe(commitments[i].commitment);
        expect(MerkleTree.verify(proof)).toBe(true);
      }
    });
  });

  describe('Data Synchronization Scenario', () => {
    it('should detect out-of-sync state via root', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      for (let i = 0; i < 100; i++) {
        tree1.append(sha256(`data-${i}`));
        tree2.append(sha256(`data-${i}`));
      }

      // In sync
      expect(tree1.root).toBe(tree2.root);

      // Tree2 gets extra data
      tree2.append(sha256('extra'));

      // Out of sync
      expect(tree1.root).not.toBe(tree2.root);
    });

    it('should identify divergence point', () => {
      const tree1 = new MerkleTree();
      const tree2 = new MerkleTree();

      // Same initial data
      for (let i = 0; i < 50; i++) {
        tree1.append(sha256(`data-${i}`));
        tree2.append(sha256(`data-${i}`));
      }

      // Diverge at entry 50
      tree1.append(sha256('tree1-data'));
      tree2.append(sha256('tree2-data'));

      // Leaves up to 49 are same
      const leaves1 = tree1.getLeaves();
      const leaves2 = tree2.getLeaves();
      for (let i = 0; i < 50; i++) {
        expect(leaves1[i]).toBe(leaves2[i]);
      }

      // Entry 50 differs
      expect(leaves1[50]).not.toBe(leaves2[50]);
    });
  });

  describe('Batch Processing Scenario', () => {
    it('should process batch of transactions', () => {
      const tree = new MerkleTree();
      const batch = Array.from({ length: 100 }, (_, i) => ({
        txId: `TX-${i}`,
        amount: Math.random() * 1000,
        from: `addr${i}`,
        to: `addr${i + 1}`
      }));

      batch.forEach(tx => tree.append(sha256(JSON.stringify(tx))));

      // Batch root represents all transactions
      expect(tree.size).toBe(100);

      // Any transaction provable
      const proof = tree.getProof(50)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should import previous batch and continue', () => {
      // Previous batch
      const previousLeaves = Array.from({ length: 100 }, (_, i) =>
        sha256(JSON.stringify({ txId: `OLD-${i}` }))
      );

      const tree = MerkleTree.import({ leaves: previousLeaves });
      expect(tree.size).toBe(100);

      // New batch
      for (let i = 0; i < 50; i++) {
        tree.append(sha256(JSON.stringify({ txId: `NEW-${i}` })));
      }

      expect(tree.size).toBe(150);

      // All entries verifiable
      expect(MerkleTree.verify(tree.getProof(0)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(99)!)).toBe(true);
      expect(MerkleTree.verify(tree.getProof(149)!)).toBe(true);
    });
  });

  describe('Snapshot and Restore Scenario', () => {
    it('should export and restore tree state', () => {
      const tree1 = new MerkleTree();
      for (let i = 0; i < 50; i++) {
        tree1.append(sha256(`entry-${i}`));
      }

      // Export state
      const leaves = tree1.getLeaves();
      const root = tree1.root;

      // Restore in new tree
      const tree2 = MerkleTree.import({ leaves });

      expect(tree2.root).toBe(root);
      expect(tree2.size).toBe(50);
    });

    it('should verify proof from restored tree', () => {
      const original = new MerkleTree();
      for (let i = 0; i < 30; i++) {
        original.append(sha256(`data-${i}`));
      }

      const proof = original.getProof(15)!;

      // Restore
      const restored = MerkleTree.import({ leaves: original.getLeaves() });
      const restoredProof = restored.getProof(15)!;

      // Same proof
      expect(restoredProof.root).toBe(proof.root);
      expect(restoredProof.leaf).toBe(proof.leaf);
      expect(MerkleTree.verify(restoredProof)).toBe(true);
    });
  });

  describe('Incremental Update Scenario', () => {
    it('should update incrementally', () => {
      const tree = new MerkleTree();

      // Initial state
      for (let i = 0; i < 10; i++) {
        tree.append(sha256(`initial-${i}`));
      }
      const rootAfter10 = tree.root;

      // Incremental updates
      for (let i = 10; i < 20; i++) {
        tree.append(sha256(`update-${i}`));
      }
      const rootAfter20 = tree.root;

      expect(rootAfter10).not.toBe(rootAfter20);
      expect(tree.size).toBe(20);
    });

    it('should maintain all proofs during updates', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 50; i++) {
        tree.append(sha256(`entry-${i}`));

        // All existing entries still provable
        for (let j = 0; j <= i; j++) {
          expect(MerkleTree.verify(tree.getProof(j)!)).toBe(true);
        }
      }
    });
  });

  describe('Hash Chain Integration', () => {
    it('should create linked hash chain', () => {
      const tree = new MerkleTree();
      let prevHash = sha256('genesis');

      for (let i = 0; i < 20; i++) {
        const entry = sha256(prevHash + `-block-${i}`);
        tree.append(entry);
        prevHash = entry;
      }

      expect(tree.size).toBe(20);

      // Each block verifiable
      for (let i = 0; i < 20; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });

    it('should verify chain integrity via tree', () => {
      const tree = new MerkleTree();
      const chain: string[] = [];
      let prev = sha256('start');

      for (let i = 0; i < 10; i++) {
        const current = sha256(prev + i);
        chain.push(current);
        tree.append(current);
        prev = current;
      }

      // Chain matches tree leaves
      expect(tree.getLeaves()).toEqual(chain);
    });
  });

  describe('Multi-Signature Scenario', () => {
    it('should collect signatures in tree', () => {
      const tree = new MerkleTree();
      const documentHash = sha256('important-document');

      const signers = ['Alice', 'Bob', 'Charlie'];
      signers.forEach(signer => {
        const signature = sha256(`${documentHash}-signed-by-${signer}`);
        tree.append(signature);
      });

      expect(tree.size).toBe(3);

      // Each signature provable
      for (let i = 0; i < 3; i++) {
        expect(MerkleTree.verify(tree.getProof(i)!)).toBe(true);
      }
    });
  });

  describe('Compliance Logging Scenario', () => {
    it('should maintain immutable compliance log', () => {
      const tree = new MerkleTree();

      for (let day = 1; day <= 30; day++) {
        const logEntry = {
          date: `2024-01-${day.toString().padStart(2, '0')}`,
          action: 'compliance_check',
          result: 'pass',
          auditor: `auditor${day % 3}`
        };
        tree.append(sha256(JSON.stringify(logEntry)));
      }

      expect(tree.size).toBe(30);

      // Any day's log provable
      const proof = tree.getProof(15)!;
      expect(MerkleTree.verify(proof)).toBe(true);
    });

    it('should provide audit root for period', () => {
      const tree = new MerkleTree();

      for (let i = 0; i < 100; i++) {
        tree.append(sha256(`audit-event-${i}`));
      }

      // Single root represents entire audit period
      const auditRoot = tree.root;
      expect(isValidHash(auditRoot)).toBe(true);
    });
  });
});
