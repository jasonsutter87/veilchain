"""VeilChain Python SDK.

Official SDK for interacting with VeilChain - the append-only Merkle tree ledger service.

Example:
    >>> from veilchain import VeilChain
    >>>
    >>> client = VeilChain(
    ...     base_url='https://api.veilchain.io',
    ...     api_key='vc_live_your_api_key'
    ... )
    >>>
    >>> # Create a ledger
    >>> ledger = client.create_ledger(name='audit-log')
    >>>
    >>> # Append an entry
    >>> result = client.append_entry(ledger.id, {
    ...     'action': 'user_login',
    ...     'user_id': 'user-123'
    ... })
    >>>
    >>> # Verify the entry
    >>> verified = client.verify_proof_local(result.proof)
    >>> print('Entry verified:', verified.valid)
"""

from .client import AsyncVeilChain, VeilChain
from .types import (
    ApiError,
    AppendEntryResult,
    CompactProof,
    HistoricalRoot,
    Ledger,
    LedgerEntry,
    ListEntriesResult,
    ListLedgersResult,
    MerkleProof,
    PublicRoot,
    PublicRootsResult,
    VeilChainError,
    VerifyProofResult,
)
from .verify import (
    hash_data,
    parse_compact_proof,
    to_compact_proof,
    verify_data,
    verify_data_with_proof,
    verify_proof,
)

__version__ = "0.1.0"

__all__ = [
    # Clients
    "VeilChain",
    "AsyncVeilChain",
    # Types
    "Ledger",
    "LedgerEntry",
    "MerkleProof",
    "CompactProof",
    "AppendEntryResult",
    "ListEntriesResult",
    "ListLedgersResult",
    "VerifyProofResult",
    "PublicRoot",
    "HistoricalRoot",
    "PublicRootsResult",
    "ApiError",
    "VeilChainError",
    # Verification functions
    "verify_proof",
    "parse_compact_proof",
    "to_compact_proof",
    "hash_data",
    "verify_data",
    "verify_data_with_proof",
]
