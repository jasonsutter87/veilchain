"""VeilChain Standalone Proof Verification.

This module provides offline proof verification without network dependencies.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Literal

from .types import CompactProof, MerkleProof, VerifyProofResult


def _hex_to_bytes(hex_str: str) -> bytes:
    """Convert a hex string to bytes."""
    return bytes.fromhex(hex_str)


def _bytes_to_hex(data: bytes) -> str:
    """Convert bytes to hex string."""
    return data.hex()


def _sha256(data: bytes) -> str:
    """Compute SHA-256 hash."""
    return hashlib.sha256(data).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    """Compute SHA-256 hash of two concatenated hashes."""
    combined = _hex_to_bytes(left) + _hex_to_bytes(right)
    return _sha256(combined)


def verify_proof(proof: MerkleProof) -> VerifyProofResult:
    """Verify a Merkle inclusion proof.

    This function verifies that a leaf is included in a Merkle tree by
    recomputing the root hash from the leaf and proof path.

    Args:
        proof: The Merkle proof to verify

    Returns:
        VerifyProofResult with verification status

    Example:
        >>> from veilchain import MerkleProof, verify_proof
        >>> proof = MerkleProof(
        ...     leaf='a1b2c3...',
        ...     index=5,
        ...     proof=['hash1', 'hash2', 'hash3'],
        ...     directions=['left', 'right', 'left'],
        ...     root='expectedRootHash...'
        ... )
        >>> result = verify_proof(proof)
        >>> if result.valid:
        ...     print('Proof is valid!')
    """
    try:
        # Validate input
        if not proof.leaf or len(proof.leaf) != 64:
            return VerifyProofResult(
                valid=False,
                leaf=proof.leaf or "",
                root=proof.root or "",
                index=proof.index or 0,
                proofLength=len(proof.proof) if proof.proof else 0,
                error="Invalid leaf hash: must be 64 character hex string",
            )

        if not proof.root or len(proof.root) != 64:
            return VerifyProofResult(
                valid=False,
                leaf=proof.leaf,
                root=proof.root or "",
                index=proof.index or 0,
                proofLength=len(proof.proof) if proof.proof else 0,
                error="Invalid root hash: must be 64 character hex string",
            )

        if len(proof.proof) != len(proof.directions):
            return VerifyProofResult(
                valid=False,
                leaf=proof.leaf,
                root=proof.root,
                index=proof.index,
                proofLength=len(proof.proof),
                error="Proof and directions arrays must have the same length",
            )

        # Compute root from leaf and proof path
        current_hash = proof.leaf

        for sibling_hash, direction in zip(proof.proof, proof.directions):
            if direction == "left":
                # Sibling is on the left, current is on the right
                current_hash = _hash_pair(sibling_hash, current_hash)
            else:
                # Sibling is on the right, current is on the left
                current_hash = _hash_pair(current_hash, sibling_hash)

        valid = current_hash == proof.root

        return VerifyProofResult(
            valid=valid,
            leaf=proof.leaf,
            root=proof.root,
            index=proof.index,
            proofLength=len(proof.proof),
            error=None if valid else "Computed root does not match expected root",
        )
    except Exception as e:
        return VerifyProofResult(
            valid=False,
            leaf=proof.leaf or "",
            root=proof.root or "",
            index=proof.index or 0,
            proofLength=len(proof.proof) if proof.proof else 0,
            error=str(e),
        )


def parse_compact_proof(compact: CompactProof) -> MerkleProof:
    """Parse a compact proof into a full MerkleProof.

    Args:
        compact: The compact proof format

    Returns:
        Full MerkleProof object

    Example:
        >>> from veilchain import parse_compact_proof, verify_proof
        >>> compact = CompactProof(v=1, l='...', r='...', i=5, p='...', d='010')
        >>> proof = parse_compact_proof(compact)
        >>> result = verify_proof(proof)
    """
    # Split concatenated proof hashes (each is 64 chars for SHA256)
    proof_hashes: list[str] = []
    for i in range(0, len(compact.p), 64):
        proof_hashes.append(compact.p[i : i + 64])

    # Parse directions from binary string
    directions: list[Literal["left", "right"]] = [
        "left" if d == "0" else "right" for d in compact.d
    ]

    return MerkleProof(
        leaf=compact.l,
        index=compact.i,
        proof=proof_hashes,
        directions=directions,
        root=compact.r,
    )


def to_compact_proof(proof: MerkleProof) -> CompactProof:
    """Convert a MerkleProof to compact format.

    Args:
        proof: The full Merkle proof

    Returns:
        Compact proof format
    """
    return CompactProof(
        v=1,
        l=proof.leaf,
        r=proof.root,
        i=proof.index,
        p="".join(proof.proof),
        d="".join("0" if d == "left" else "1" for d in proof.directions),
    )


def hash_data(data: Any) -> str:
    """Hash arbitrary data to create a leaf hash.

    Args:
        data: The data to hash (will be JSON serialized if not a string)

    Returns:
        SHA-256 hash as hex string

    Example:
        >>> from veilchain import hash_data
        >>> hash_value = hash_data({'vote': 'yes', 'voter': 'alice'})
        >>> print(hash_value)  # '5a3b...'
    """
    serialized = data if isinstance(data, str) else json.dumps(data, separators=(",", ":"))
    return _sha256(serialized.encode("utf-8"))


def verify_data(data: Any, expected_hash: str) -> bool:
    """Verify that data matches a given hash.

    Args:
        data: The data to verify
        expected_hash: The expected hash

    Returns:
        True if hashes match

    Example:
        >>> from veilchain import verify_data
        >>> is_valid = verify_data({'vote': 'yes'}, '5a3b...')
    """
    actual_hash = hash_data(data)
    return actual_hash == expected_hash


class DataVerifyResult(VerifyProofResult):
    """Extended verification result including data match status."""

    data_match: bool


def verify_data_with_proof(data: Any, proof: MerkleProof) -> DataVerifyResult:
    """Verify a proof against known data.

    This combines data verification with proof verification to ensure
    both the data matches the leaf hash AND the leaf is in the tree.

    Args:
        data: The original data
        proof: The Merkle proof

    Returns:
        Verification result with data_match status

    Example:
        >>> from veilchain import verify_data_with_proof
        >>> vote = {'vote': 'yes', 'voter': 'alice'}
        >>> result = verify_data_with_proof(vote, proof)
        >>> if result.valid and result.data_match:
        ...     print('Vote is verified in the ledger!')
    """
    data_hash = hash_data(data)
    data_match = data_hash == proof.leaf

    if not data_match:
        return DataVerifyResult(
            valid=False,
            data_match=False,
            leaf=proof.leaf,
            root=proof.root,
            index=proof.index,
            proofLength=len(proof.proof),
            error="Data hash does not match proof leaf",
        )

    proof_result = verify_proof(proof)
    return DataVerifyResult(
        valid=proof_result.valid,
        data_match=True,
        leaf=proof_result.leaf,
        root=proof_result.root,
        index=proof_result.index,
        proofLength=proof_result.proof_length,
        error=proof_result.error,
    )
