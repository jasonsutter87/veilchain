-- VeilChain Database Schema
-- Append-only ledger with Merkle tree integrity

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ledgers table
CREATE TABLE ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    root_hash CHAR(64) NOT NULL,
    entry_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entries table (append-only)
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    position BIGINT NOT NULL,
    data JSONB NOT NULL,
    hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique position per ledger
    CONSTRAINT unique_position_per_ledger UNIQUE (ledger_id, position)
);

-- Index for efficient position lookups
CREATE INDEX idx_entries_ledger_position ON entries(ledger_id, position);

-- Index for hash lookups
CREATE INDEX idx_entries_hash ON entries(hash);

-- Anchor records for external timestamping
CREATE TABLE anchors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    root_hash CHAR(64) NOT NULL,
    tree_size BIGINT NOT NULL,
    destination VARCHAR(50) NOT NULL,  -- 'bitcoin', 'ethereum', etc.
    transaction_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Idempotency keys for duplicate prevention
CREATE TABLE idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    entry_id UUID REFERENCES entries(id),
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for expiration cleanup
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Prevent modifications to entries (append-only enforcement)
CREATE OR REPLACE FUNCTION prevent_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Entries cannot be modified - append-only ledger';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Entries cannot be deleted - append-only ledger';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_append_only
BEFORE UPDATE OR DELETE ON entries
FOR EACH ROW EXECUTE FUNCTION prevent_entry_modification();

-- Auto-update timestamp on ledgers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ledgers_updated_at
BEFORE UPDATE ON ledgers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Clean up expired idempotency keys (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
