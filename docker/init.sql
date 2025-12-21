-- VeilChain Database Schema
-- Append-only ledger with Merkle tree integrity

-- Ledgers table
CREATE TABLE ledgers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    root_hash CHAR(64) NOT NULL,
    entry_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing ledgers by creation date
CREATE INDEX idx_ledgers_created_at ON ledgers(created_at DESC);

-- Entries table (append-only)
CREATE TABLE entries (
    id VARCHAR(128) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id),
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

-- Index for listing entries by ledger
CREATE INDEX idx_entries_ledger_created ON entries(ledger_id, created_at);

-- Idempotency keys for duplicate prevention
CREATE TABLE idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id),
    entry_id VARCHAR(128) REFERENCES entries(id),
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

-- ============================================
-- VeilChain Phase 4: Authentication Schema
-- ============================================

-- Users table
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),  -- bcrypt hash (null for OAuth-only users)
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(128),
    email_verification_expires TIMESTAMPTZ,
    password_reset_token VARCHAR(128),
    password_reset_expires TIMESTAMPTZ,
    oauth_provider VARCHAR(32),  -- 'github', 'google', null for email/password
    oauth_provider_id VARCHAR(255),
    avatar_url TEXT,
    tier VARCHAR(32) DEFAULT 'FREE',  -- FREE, STARTER, PRO, ENTERPRISE
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT unique_oauth_user UNIQUE (oauth_provider, oauth_provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_provider_id);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Trigger for users updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- API Keys table (bcrypt hashed storage)
CREATE TABLE api_keys (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,  -- First chars for identification (e.g., "vc_live_abc")
    key_hash VARCHAR(255) NOT NULL,   -- bcrypt hash of full key
    key_type VARCHAR(32) NOT NULL,    -- 'admin', 'write', 'read', 'scoped'
    scoped_ledgers VARCHAR(64)[],     -- For 'scoped' type: array of ledger IDs
    permissions JSONB,                -- Fine-grained permissions
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,
    rate_limit_override JSONB,        -- Optional per-key rate limit config
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255)
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_type ON api_keys(key_type);
CREATE INDEX idx_api_keys_created_at ON api_keys(created_at DESC);

-- Refresh Tokens table
CREATE TABLE refresh_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,  -- SHA-256 hash of token
    family_id VARCHAR(64) NOT NULL,    -- Token family for rotation detection
    expires_at TIMESTAMPTZ NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    user_agent TEXT,
    ip_address INET,

    CONSTRAINT unique_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Add owner_id to ledgers table for multi-tenancy
ALTER TABLE ledgers ADD COLUMN owner_id VARCHAR(64) REFERENCES users(id);

-- Ledger Permissions (multi-tenancy access control)
CREATE TABLE ledger_permissions (
    id VARCHAR(64) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,  -- 'owner', 'admin', 'write', 'read'
    granted_by VARCHAR(64) REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    CONSTRAINT unique_ledger_permission UNIQUE (ledger_id, user_id)
);

CREATE INDEX idx_ledger_permissions_ledger ON ledger_permissions(ledger_id);
CREATE INDEX idx_ledger_permissions_user ON ledger_permissions(user_id);
CREATE INDEX idx_ledger_permissions_role ON ledger_permissions(role);

-- Audit Logs (append-only activity tracking)
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id),
    api_key_id VARCHAR(64) REFERENCES api_keys(id),
    action VARCHAR(64) NOT NULL,  -- 'login', 'logout', 'create_ledger', 'append_entry', etc.
    resource_type VARCHAR(32),    -- 'ledger', 'entry', 'api_key', 'user'
    resource_id VARCHAR(128),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_api_key ON audit_logs(api_key_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Prevent modifications to audit_logs (append-only enforcement)
CREATE TRIGGER enforce_audit_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_entry_modification();

-- Token Blocklist (for JWT revocation)
CREATE TABLE token_blocklist (
    jti VARCHAR(64) PRIMARY KEY,   -- JWT ID
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason VARCHAR(255)
);

CREATE INDEX idx_token_blocklist_user ON token_blocklist(user_id);
CREATE INDEX idx_token_blocklist_expires ON token_blocklist(expires_at);

-- OAuth State table (CSRF protection)
CREATE TABLE oauth_states (
    state VARCHAR(128) PRIMARY KEY,
    redirect_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);

CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    DELETE FROM token_blocklist WHERE expires_at < NOW();
    DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
