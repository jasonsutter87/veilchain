"""VeilChain SDK Type Definitions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class MerkleProof(BaseModel):
    """Merkle proof for inclusion verification."""

    leaf: str = Field(..., description="The hash of the leaf (entry) being proven")
    index: int = Field(..., description="The position/index of the entry in the tree")
    proof: list[str] = Field(..., description="Array of sibling hashes for the proof path")
    directions: list[Literal["left", "right"]] = Field(
        ..., description="Direction of each sibling"
    )
    root: str = Field(..., description="The root hash of the Merkle tree")


class CompactProof(BaseModel):
    """Compact proof format for efficient storage/transmission."""

    v: int = Field(..., description="Version number")
    l: str = Field(..., description="Leaf hash")
    r: str = Field(..., description="Root hash")
    i: int = Field(..., description="Index")
    p: str = Field(..., description="Concatenated proof hashes")
    d: str = Field(..., description="Direction bits as string ('0' = left, '1' = right)")


class Ledger(BaseModel):
    """Ledger metadata."""

    id: str = Field(..., description="Unique ledger identifier")
    name: str = Field(..., description="Human-readable name")
    description: str | None = Field(None, description="Optional description")
    root_hash: str = Field(..., alias="rootHash", description="Current Merkle root hash")
    entry_count: str = Field(..., alias="entryCount", description="Total number of entries")
    created_at: str = Field(..., alias="createdAt", description="Creation timestamp (ISO 8601)")
    last_entry_at: str | None = Field(
        None, alias="lastEntryAt", description="Last entry timestamp (ISO 8601)"
    )
    schema_: dict[str, Any] | None = Field(
        None, alias="schema", description="Optional JSON Schema for entry validation"
    )

    class Config:
        populate_by_name = True


class LedgerEntry(BaseModel):
    """Ledger entry."""

    id: str = Field(..., description="Unique entry identifier")
    position: str = Field(..., description="Position in the ledger (0-indexed)")
    data: Any = Field(..., description="Entry data")
    hash: str = Field(..., description="SHA-256 hash of the entry")
    created_at: str = Field(..., alias="createdAt", description="Creation timestamp (ISO 8601)")
    proof: MerkleProof | None = Field(None, description="Inclusion proof (if requested)")

    class Config:
        populate_by_name = True


class AppendEntryResult(BaseModel):
    """Result of appending an entry."""

    entry: LedgerEntry = Field(..., description="The created entry")
    proof: MerkleProof = Field(..., description="Inclusion proof for the entry")
    previous_root: str = Field(..., alias="previousRoot", description="Root hash before append")
    new_root: str = Field(..., alias="newRoot", description="Root hash after append")

    class Config:
        populate_by_name = True


class ListEntriesResult(BaseModel):
    """Paginated list of entries."""

    entries: list[LedgerEntry] = Field(..., description="Array of entries")
    total: str = Field(..., description="Total number of entries")
    offset: str = Field(..., description="Current offset")
    limit: int = Field(..., description="Page size limit")


class ListLedgersResult(BaseModel):
    """Paginated list of ledgers."""

    ledgers: list[Ledger] = Field(..., description="Array of ledgers")
    total: int = Field(..., description="Total number of ledgers")
    offset: int = Field(..., description="Current offset")
    limit: int = Field(..., description="Page size limit")


class VerifyProofResult(BaseModel):
    """Proof verification result."""

    valid: bool = Field(..., description="Whether the proof is valid")
    leaf: str = Field(..., description="Leaf hash that was verified")
    root: str = Field(..., description="Root hash that was verified against")
    index: int = Field(..., description="Entry index")
    proof_length: int = Field(..., alias="proofLength", description="Number of proof hashes")
    error: str | None = Field(None, description="Error message if verification failed")

    class Config:
        populate_by_name = True


class PublicRoot(BaseModel):
    """Public root information."""

    ledger_id: str = Field(..., alias="ledgerId", description="Ledger ID")
    root_hash: str = Field(..., alias="rootHash", description="Current root hash")
    entry_count: str = Field(..., alias="entryCount", description="Entry count")
    timestamp: str = Field(..., description="Timestamp")
    signature: str | None = Field(None, description="Optional signature")

    class Config:
        populate_by_name = True


class HistoricalRoot(BaseModel):
    """Historical root entry."""

    root_hash: str = Field(..., alias="rootHash", description="Root hash at this point")
    entry_count: str = Field(..., alias="entryCount", description="Entry count at this point")
    timestamp: str = Field(..., description="Timestamp")
    signature: str | None = Field(None, description="Optional signature")

    class Config:
        populate_by_name = True


class PublicRootsResult(BaseModel):
    """Result of fetching historical roots."""

    ledger_id: str = Field(..., alias="ledgerId", description="Ledger ID")
    roots: list[HistoricalRoot] = Field(..., description="Historical roots")
    total: int = Field(..., description="Total count")
    offset: int = Field(..., description="Current offset")
    limit: int = Field(..., description="Page size limit")

    class Config:
        populate_by_name = True


class ApiError(BaseModel):
    """API error response."""

    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Human-readable error message")
    details: Any | None = Field(None, description="Additional error details")


class VeilChainError(Exception):
    """VeilChain SDK error."""

    def __init__(
        self,
        message: str,
        status: int | None = None,
        code: str | None = None,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details
