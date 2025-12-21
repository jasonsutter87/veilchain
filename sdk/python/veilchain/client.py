"""VeilChain SDK Client.

Main client for interacting with the VeilChain API.
"""

from __future__ import annotations

from typing import Any, TypeVar

import httpx

from .types import (
    AppendEntryResult,
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
from .verify import verify_proof as local_verify_proof

T = TypeVar("T")


class VeilChain:
    """VeilChain SDK Client.

    Example:
        >>> from veilchain import VeilChain
        >>>
        >>> client = VeilChain(
        ...     base_url='https://api.veilchain.io',
        ...     api_key='vc_live_...'
        ... )
        >>>
        >>> # Create a ledger
        >>> ledger = client.create_ledger(name='votes')
        >>>
        >>> # Append an entry
        >>> result = client.append_entry(ledger.id, {'vote': 'yes'})
        >>>
        >>> # Verify the entry
        >>> verified = client.verify_proof_local(result.proof)
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        token: str | None = None,
        timeout: float = 30.0,
        retries: int = 3,
    ) -> None:
        """Initialize the VeilChain client.

        Args:
            base_url: Base URL of the VeilChain API
            api_key: API key for authentication
            token: JWT token for authentication
            timeout: Request timeout in seconds
            retries: Number of retry attempts for failed requests
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.token = token
        self.timeout = timeout
        self.retries = retries
        self._client = httpx.Client(timeout=timeout)

    def __enter__(self) -> VeilChain:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def _get_headers(self, skip_auth: bool = False) -> dict[str, str]:
        """Get request headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if not skip_auth:
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            elif self.api_key:
                headers["X-API-Key"] = self.api_key
        return headers

    def _request(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        skip_auth: bool = False,
    ) -> Any:
        """Make an authenticated API request."""
        url = f"{self.base_url}{path}"
        headers = self._get_headers(skip_auth)

        last_error: Exception | None = None

        for attempt in range(self.retries + 1):
            try:
                response = self._client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body,
                )

                if not response.is_success:
                    error_body = response.json() if response.content else {}
                    error_info = error_body.get("error", {})
                    raise VeilChainError(
                        message=error_info.get("message", f"HTTP {response.status_code}"),
                        status=response.status_code,
                        code=error_info.get("code"),
                        details=error_info.get("details"),
                    )

                return response.json() if response.content else None

            except VeilChainError as e:
                # Don't retry on client errors (4xx)
                if e.status and 400 <= e.status < 500:
                    raise
                last_error = e

            except Exception as e:
                last_error = e

            # Wait before retry with exponential backoff
            if attempt < self.retries:
                import time

                time.sleep(2**attempt * 0.1)

        if last_error:
            raise last_error
        raise VeilChainError("Request failed after retries")

    # ============================================================
    # Ledger Operations
    # ============================================================

    def create_ledger(
        self,
        name: str,
        description: str | None = None,
        schema: dict[str, Any] | None = None,
    ) -> Ledger:
        """Create a new ledger.

        Args:
            name: Ledger name
            description: Optional description
            schema: Optional JSON Schema for entry validation

        Returns:
            The created ledger

        Example:
            >>> ledger = client.create_ledger(
            ...     name='election-2024',
            ...     description='Presidential election votes'
            ... )
        """
        body: dict[str, Any] = {"name": name}
        if description:
            body["description"] = description
        if schema:
            body["schema"] = schema

        data = self._request("POST", "/v1/ledgers", body)
        return Ledger.model_validate(data)

    def get_ledger(self, ledger_id: str) -> Ledger | None:
        """Get a ledger by ID.

        Args:
            ledger_id: The ledger ID

        Returns:
            The ledger metadata or None if not found
        """
        try:
            data = self._request("GET", f"/v1/ledgers/{ledger_id}")
            return Ledger.model_validate(data)
        except VeilChainError as e:
            if e.status == 404:
                return None
            raise

    def list_ledgers(
        self,
        offset: int = 0,
        limit: int = 100,
    ) -> ListLedgersResult:
        """List all ledgers.

        Args:
            offset: Number of ledgers to skip
            limit: Maximum ledgers to return

        Returns:
            Paginated list of ledgers
        """
        params = f"?offset={offset}&limit={limit}"
        data = self._request("GET", f"/v1/ledgers{params}")
        return ListLedgersResult.model_validate(data)

    def delete_ledger(self, ledger_id: str) -> None:
        """Delete a ledger (soft delete).

        Args:
            ledger_id: The ledger ID to delete
        """
        self._request("DELETE", f"/v1/ledgers/{ledger_id}")

    # ============================================================
    # Entry Operations
    # ============================================================

    def append_entry(
        self,
        ledger_id: str,
        data: Any,
        idempotency_key: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AppendEntryResult:
        """Append an entry to a ledger.

        Args:
            ledger_id: The target ledger ID
            data: The entry data
            idempotency_key: Key to prevent duplicate entries
            metadata: Additional metadata

        Returns:
            The created entry with proof

        Example:
            >>> result = client.append_entry('ledger-123', {
            ...     'vote': 'yes',
            ...     'timestamp': datetime.now().isoformat()
            ... }, idempotency_key='vote-alice-2024')
            >>>
            >>> print('Entry ID:', result.entry.id)
            >>> print('New root:', result.new_root)
        """
        body: dict[str, Any] = {"data": data}
        if idempotency_key:
            body["idempotencyKey"] = idempotency_key
        if metadata:
            body["metadata"] = metadata

        response = self._request("POST", f"/v1/ledgers/{ledger_id}/entries", body)
        return AppendEntryResult.model_validate(response)

    def get_entry(
        self,
        ledger_id: str,
        entry_id: str,
        include_proof: bool = False,
    ) -> LedgerEntry | None:
        """Get an entry by ID.

        Args:
            ledger_id: The ledger ID
            entry_id: The entry ID
            include_proof: Whether to include the Merkle proof

        Returns:
            The entry or None if not found
        """
        try:
            params = "?proof=true" if include_proof else ""
            data = self._request("GET", f"/v1/ledgers/{ledger_id}/entries/{entry_id}{params}")
            return LedgerEntry.model_validate(data)
        except VeilChainError as e:
            if e.status == 404:
                return None
            raise

    def list_entries(
        self,
        ledger_id: str,
        offset: int = 0,
        limit: int = 100,
    ) -> ListEntriesResult:
        """List entries in a ledger.

        Args:
            ledger_id: The ledger ID
            offset: Number of entries to skip
            limit: Maximum entries to return

        Returns:
            Paginated list of entries
        """
        params = f"?offset={offset}&limit={limit}"
        data = self._request("GET", f"/v1/ledgers/{ledger_id}/entries{params}")
        return ListEntriesResult.model_validate(data)

    # ============================================================
    # Proof Operations
    # ============================================================

    def get_proof(self, ledger_id: str, entry_id: str) -> MerkleProof:
        """Get an inclusion proof for an entry.

        Args:
            ledger_id: The ledger ID
            entry_id: The entry ID

        Returns:
            The Merkle proof
        """
        data = self._request("GET", f"/v1/ledgers/{ledger_id}/proof/{entry_id}")
        return MerkleProof.model_validate(data["proof"])

    def verify_proof_local(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof locally (offline).

        This verifies the proof cryptographically without network access.

        Args:
            proof: The Merkle proof to verify

        Returns:
            Verification result
        """
        return local_verify_proof(proof)

    def verify_proof(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof via the API.

        Args:
            proof: The Merkle proof to verify

        Returns:
            Verification result
        """
        data = self._request("POST", "/v1/verify", {"proof": proof.model_dump()})
        return VerifyProofResult.model_validate(data)

    # ============================================================
    # Public (Unauthenticated) Operations
    # ============================================================

    def get_public_root(self, ledger_id: str) -> PublicRoot:
        """Get the current root hash of a ledger (public, no auth required).

        This endpoint can be used by anyone to verify the current state
        of a ledger without authentication.

        Args:
            ledger_id: The ledger ID

        Returns:
            The current root information
        """
        data = self._request(
            "GET", f"/v1/public/ledgers/{ledger_id}/root", skip_auth=True
        )
        return PublicRoot.model_validate(data)

    def get_public_roots(
        self,
        ledger_id: str,
        offset: int = 0,
        limit: int = 100,
    ) -> PublicRootsResult:
        """Get historical root hashes (public, no auth required).

        Args:
            ledger_id: The ledger ID
            offset: Number of roots to skip
            limit: Maximum roots to return

        Returns:
            Paginated list of historical roots
        """
        params = f"?offset={offset}&limit={limit}"
        data = self._request(
            "GET", f"/v1/public/ledgers/{ledger_id}/roots{params}", skip_auth=True
        )
        return PublicRootsResult.model_validate(data)

    def verify_public(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof via the public API (no auth required).

        Args:
            proof: The Merkle proof to verify

        Returns:
            Verification result
        """
        data = self._request(
            "POST", "/v1/public/verify", {"proof": proof.model_dump()}, skip_auth=True
        )
        return VerifyProofResult.model_validate(data)

    # ============================================================
    # Utility Methods
    # ============================================================

    def get_current_root(self, ledger_id: str) -> dict[str, str]:
        """Get the current root hash of a ledger.

        Args:
            ledger_id: The ledger ID

        Returns:
            The current root hash and entry count
        """
        return self._request("GET", f"/v1/ledgers/{ledger_id}/root")

    def health(self) -> dict[str, str]:
        """Health check.

        Returns:
            API health status
        """
        return self._request("GET", "/health", skip_auth=True)

    def set_token(self, token: str) -> None:
        """Update authentication token.

        Args:
            token: New JWT token
        """
        self.token = token

    def set_api_key(self, api_key: str) -> None:
        """Update API key.

        Args:
            api_key: New API key
        """
        self.api_key = api_key


class AsyncVeilChain:
    """Async VeilChain SDK Client.

    Example:
        >>> from veilchain import AsyncVeilChain
        >>> import asyncio
        >>>
        >>> async def main():
        ...     async with AsyncVeilChain(
        ...         base_url='https://api.veilchain.io',
        ...         api_key='vc_live_...'
        ...     ) as client:
        ...         ledger = await client.create_ledger(name='votes')
        ...         result = await client.append_entry(ledger.id, {'vote': 'yes'})
        >>>
        >>> asyncio.run(main())
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        token: str | None = None,
        timeout: float = 30.0,
        retries: int = 3,
    ) -> None:
        """Initialize the async VeilChain client."""
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.token = token
        self.timeout = timeout
        self.retries = retries
        self._client = httpx.AsyncClient(timeout=timeout)

    async def __aenter__(self) -> AsyncVeilChain:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()

    def _get_headers(self, skip_auth: bool = False) -> dict[str, str]:
        """Get request headers."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if not skip_auth:
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            elif self.api_key:
                headers["X-API-Key"] = self.api_key
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        skip_auth: bool = False,
    ) -> Any:
        """Make an authenticated API request."""
        import asyncio

        url = f"{self.base_url}{path}"
        headers = self._get_headers(skip_auth)

        last_error: Exception | None = None

        for attempt in range(self.retries + 1):
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body,
                )

                if not response.is_success:
                    error_body = response.json() if response.content else {}
                    error_info = error_body.get("error", {})
                    raise VeilChainError(
                        message=error_info.get("message", f"HTTP {response.status_code}"),
                        status=response.status_code,
                        code=error_info.get("code"),
                        details=error_info.get("details"),
                    )

                return response.json() if response.content else None

            except VeilChainError as e:
                if e.status and 400 <= e.status < 500:
                    raise
                last_error = e

            except Exception as e:
                last_error = e

            if attempt < self.retries:
                await asyncio.sleep(2**attempt * 0.1)

        if last_error:
            raise last_error
        raise VeilChainError("Request failed after retries")

    # All the same methods as VeilChain but with async/await
    async def create_ledger(
        self,
        name: str,
        description: str | None = None,
        schema: dict[str, Any] | None = None,
    ) -> Ledger:
        """Create a new ledger."""
        body: dict[str, Any] = {"name": name}
        if description:
            body["description"] = description
        if schema:
            body["schema"] = schema
        data = await self._request("POST", "/v1/ledgers", body)
        return Ledger.model_validate(data)

    async def get_ledger(self, ledger_id: str) -> Ledger | None:
        """Get a ledger by ID."""
        try:
            data = await self._request("GET", f"/v1/ledgers/{ledger_id}")
            return Ledger.model_validate(data)
        except VeilChainError as e:
            if e.status == 404:
                return None
            raise

    async def list_ledgers(self, offset: int = 0, limit: int = 100) -> ListLedgersResult:
        """List all ledgers."""
        params = f"?offset={offset}&limit={limit}"
        data = await self._request("GET", f"/v1/ledgers{params}")
        return ListLedgersResult.model_validate(data)

    async def delete_ledger(self, ledger_id: str) -> None:
        """Delete a ledger."""
        await self._request("DELETE", f"/v1/ledgers/{ledger_id}")

    async def append_entry(
        self,
        ledger_id: str,
        data: Any,
        idempotency_key: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AppendEntryResult:
        """Append an entry to a ledger."""
        body: dict[str, Any] = {"data": data}
        if idempotency_key:
            body["idempotencyKey"] = idempotency_key
        if metadata:
            body["metadata"] = metadata
        response = await self._request("POST", f"/v1/ledgers/{ledger_id}/entries", body)
        return AppendEntryResult.model_validate(response)

    async def get_entry(
        self,
        ledger_id: str,
        entry_id: str,
        include_proof: bool = False,
    ) -> LedgerEntry | None:
        """Get an entry by ID."""
        try:
            params = "?proof=true" if include_proof else ""
            data = await self._request(
                "GET", f"/v1/ledgers/{ledger_id}/entries/{entry_id}{params}"
            )
            return LedgerEntry.model_validate(data)
        except VeilChainError as e:
            if e.status == 404:
                return None
            raise

    async def list_entries(
        self, ledger_id: str, offset: int = 0, limit: int = 100
    ) -> ListEntriesResult:
        """List entries in a ledger."""
        params = f"?offset={offset}&limit={limit}"
        data = await self._request("GET", f"/v1/ledgers/{ledger_id}/entries{params}")
        return ListEntriesResult.model_validate(data)

    async def get_proof(self, ledger_id: str, entry_id: str) -> MerkleProof:
        """Get an inclusion proof for an entry."""
        data = await self._request("GET", f"/v1/ledgers/{ledger_id}/proof/{entry_id}")
        return MerkleProof.model_validate(data["proof"])

    def verify_proof_local(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof locally (offline)."""
        return local_verify_proof(proof)

    async def verify_proof(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof via the API."""
        data = await self._request("POST", "/v1/verify", {"proof": proof.model_dump()})
        return VerifyProofResult.model_validate(data)

    async def get_public_root(self, ledger_id: str) -> PublicRoot:
        """Get the current root hash (public)."""
        data = await self._request(
            "GET", f"/v1/public/ledgers/{ledger_id}/root", skip_auth=True
        )
        return PublicRoot.model_validate(data)

    async def get_public_roots(
        self, ledger_id: str, offset: int = 0, limit: int = 100
    ) -> PublicRootsResult:
        """Get historical roots (public)."""
        params = f"?offset={offset}&limit={limit}"
        data = await self._request(
            "GET", f"/v1/public/ledgers/{ledger_id}/roots{params}", skip_auth=True
        )
        return PublicRootsResult.model_validate(data)

    async def verify_public(self, proof: MerkleProof) -> VerifyProofResult:
        """Verify a proof via public API."""
        data = await self._request(
            "POST", "/v1/public/verify", {"proof": proof.model_dump()}, skip_auth=True
        )
        return VerifyProofResult.model_validate(data)

    async def get_current_root(self, ledger_id: str) -> dict[str, str]:
        """Get the current root hash."""
        return await self._request("GET", f"/v1/ledgers/{ledger_id}/root")

    async def health(self) -> dict[str, str]:
        """Health check."""
        return await self._request("GET", "/health", skip_auth=True)

    def set_token(self, token: str) -> None:
        """Update authentication token."""
        self.token = token

    def set_api_key(self, api_key: str) -> None:
        """Update API key."""
        self.api_key = api_key
