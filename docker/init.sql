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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ  -- NULL = active, set = archived (soft deleted)
);

-- Index for listing ledgers by creation date
CREATE INDEX idx_ledgers_created_at ON ledgers(created_at DESC);

-- Index for filtering active (non-archived) ledgers
CREATE INDEX idx_ledgers_archived ON ledgers(archived_at) WHERE archived_at IS NULL;

-- Entries table (append-only with cryptographic chaining)
CREATE TABLE entries (
    id VARCHAR(128) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id),
    position BIGINT NOT NULL,
    data JSONB NOT NULL,
    hash CHAR(64) NOT NULL,
    parent_hash CHAR(64) NOT NULL,  -- Hash of previous entry (cryptographic chaining)
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

-- Enforce sequential positions and cryptographic chain integrity
CREATE OR REPLACE FUNCTION enforce_sequence_and_chain()
RETURNS TRIGGER AS $$
DECLARE
    expected_position BIGINT;
    previous_hash CHAR(64);
    genesis_hash CONSTANT CHAR(64) := 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; -- SHA256('')
BEGIN
    -- Get the current max position for this ledger
    SELECT COALESCE(MAX(position), -1) INTO expected_position
    FROM entries
    WHERE ledger_id = NEW.ledger_id;

    -- New entry must be exactly one greater than max (or 0 for first entry)
    IF NEW.position != expected_position + 1 THEN
        RAISE EXCEPTION 'Sequence violation: expected position %, got %', expected_position + 1, NEW.position;
    END IF;

    -- Validate cryptographic chain
    IF NEW.position = 0 THEN
        -- First entry must have genesis hash as parent
        IF NEW.parent_hash != genesis_hash THEN
            RAISE EXCEPTION 'Genesis entry must have empty parent_hash (SHA256 of empty string)';
        END IF;
    ELSE
        -- Get hash of previous entry
        SELECT hash INTO previous_hash
        FROM entries
        WHERE ledger_id = NEW.ledger_id AND position = NEW.position - 1;

        IF NEW.parent_hash != previous_hash THEN
            RAISE EXCEPTION 'Chain integrity violation: parent_hash does not match previous entry hash';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_entry_sequence
BEFORE INSERT ON entries
FOR EACH ROW EXECUTE FUNCTION enforce_sequence_and_chain();

-- Verify tree integrity (background check function)
CREATE OR REPLACE FUNCTION verify_ledger_integrity(p_ledger_id VARCHAR(64))
RETURNS TABLE(
    is_valid BOOLEAN,
    entry_count BIGINT,
    chain_valid BOOLEAN,
    sequence_valid BOOLEAN,
    errors TEXT[]
) AS $$
DECLARE
    v_entry_count BIGINT;
    v_chain_valid BOOLEAN := TRUE;
    v_sequence_valid BOOLEAN := TRUE;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_prev_hash CHAR(64);
    v_prev_position BIGINT := -1;
    v_genesis_hash CONSTANT CHAR(64) := 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    r RECORD;
BEGIN
    -- Count entries
    SELECT COUNT(*) INTO v_entry_count FROM entries WHERE ledger_id = p_ledger_id;

    -- Verify chain and sequence
    FOR r IN
        SELECT position, hash, parent_hash
        FROM entries
        WHERE ledger_id = p_ledger_id
        ORDER BY position ASC
    LOOP
        -- Check sequence
        IF r.position != v_prev_position + 1 THEN
            v_sequence_valid := FALSE;
            v_errors := array_append(v_errors, format('Sequence gap at position %s (expected %s)', r.position, v_prev_position + 1));
        END IF;

        -- Check chain
        IF r.position = 0 THEN
            IF r.parent_hash != v_genesis_hash THEN
                v_chain_valid := FALSE;
                v_errors := array_append(v_errors, 'Genesis entry has invalid parent_hash');
            END IF;
        ELSE
            IF r.parent_hash != v_prev_hash THEN
                v_chain_valid := FALSE;
                v_errors := array_append(v_errors, format('Chain break at position %s', r.position));
            END IF;
        END IF;

        v_prev_position := r.position;
        v_prev_hash := r.hash;
    END LOOP;

    RETURN QUERY SELECT
        v_chain_valid AND v_sequence_valid,
        v_entry_count,
        v_chain_valid,
        v_sequence_valid,
        v_errors;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================
-- VeilChain Phase 5: Security & Abuse Detection
-- ============================================

-- Usage metrics for rate limiting and anomaly detection
CREATE TABLE usage_metrics (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id),
    api_key_id VARCHAR(64) REFERENCES api_keys(id),
    ip_address INET NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code SMALLINT,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- At least one identifier required
    CONSTRAINT usage_has_identifier CHECK (user_id IS NOT NULL OR api_key_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- Indexes for efficient querying
CREATE INDEX idx_usage_metrics_user ON usage_metrics(user_id, created_at DESC);
CREATE INDEX idx_usage_metrics_api_key ON usage_metrics(api_key_id, created_at DESC);
CREATE INDEX idx_usage_metrics_ip ON usage_metrics(ip_address, created_at DESC);
CREATE INDEX idx_usage_metrics_endpoint ON usage_metrics(endpoint, created_at DESC);
CREATE INDEX idx_usage_metrics_created ON usage_metrics(created_at DESC);

-- Partitioning hint: Consider partitioning by created_at for high-volume deployments

-- Aggregated usage stats (hourly rollups)
CREATE TABLE usage_stats_hourly (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id),
    api_key_id VARCHAR(64) REFERENCES api_keys(id),
    hour_bucket TIMESTAMPTZ NOT NULL,
    endpoint VARCHAR(255),
    request_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    avg_response_time_ms REAL,
    p95_response_time_ms INTEGER,
    total_request_size BIGINT DEFAULT 0,
    total_response_size BIGINT DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_hourly_stat UNIQUE (user_id, api_key_id, hour_bucket, endpoint)
);

CREATE INDEX idx_usage_stats_hourly_user ON usage_stats_hourly(user_id, hour_bucket DESC);
CREATE INDEX idx_usage_stats_hourly_bucket ON usage_stats_hourly(hour_bucket DESC);

-- IP reputation tracking
CREATE TABLE ip_reputation (
    ip_address INET PRIMARY KEY,
    reputation_score INTEGER NOT NULL DEFAULT 100,  -- 0-100, lower is worse
    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',  -- low, medium, high, critical
    is_blocked BOOLEAN DEFAULT FALSE,
    is_vpn BOOLEAN,
    is_proxy BOOLEAN,
    is_tor BOOLEAN,
    is_datacenter BOOLEAN,
    country_code CHAR(2),
    asn VARCHAR(64),
    asn_org VARCHAR(255),

    -- Abuse indicators
    failed_auth_count INTEGER DEFAULT 0,
    rate_limit_hits INTEGER DEFAULT 0,
    suspicious_activity_count INTEGER DEFAULT 0,
    abuse_reports INTEGER DEFAULT 0,

    -- Timestamps
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked_at TIMESTAMPTZ,
    blocked_reason VARCHAR(255),
    blocked_until TIMESTAMPTZ,

    -- Metadata
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ip_reputation_score ON ip_reputation(reputation_score);
CREATE INDEX idx_ip_reputation_risk ON ip_reputation(risk_level);
CREATE INDEX idx_ip_reputation_blocked ON ip_reputation(is_blocked) WHERE is_blocked = TRUE;
CREATE INDEX idx_ip_reputation_last_seen ON ip_reputation(last_seen_at DESC);

-- Trigger for ip_reputation updated_at
CREATE TRIGGER update_ip_reputation_updated_at
BEFORE UPDATE ON ip_reputation
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Security events (suspicious activity tracking)
CREATE TABLE security_events (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,  -- 'failed_login', 'rate_limit_exceeded', 'suspicious_pattern', etc.
    severity VARCHAR(16) NOT NULL,     -- 'info', 'warning', 'high', 'critical'
    user_id VARCHAR(64) REFERENCES users(id),
    api_key_id VARCHAR(64) REFERENCES api_keys(id),
    ip_address INET,
    endpoint VARCHAR(255),
    description TEXT,
    details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, created_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_ip ON security_events(ip_address, created_at DESC);
CREATE INDEX idx_security_events_unresolved ON security_events(resolved, created_at DESC) WHERE resolved = FALSE;

-- Prevent modifications to security_events (append-only)
CREATE TRIGGER enforce_security_events_append_only
BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW EXECUTE FUNCTION prevent_entry_modification();

-- Failed authentication attempts (for brute force detection)
CREATE TABLE failed_auth_attempts (
    id VARCHAR(64) PRIMARY KEY,
    ip_address INET NOT NULL,
    email VARCHAR(255),
    user_id VARCHAR(64) REFERENCES users(id),
    attempt_type VARCHAR(32) NOT NULL,  -- 'login', 'api_key', 'token_refresh'
    failure_reason VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_failed_auth_ip ON failed_auth_attempts(ip_address, created_at DESC);
CREATE INDEX idx_failed_auth_email ON failed_auth_attempts(email, created_at DESC);
CREATE INDEX idx_failed_auth_created ON failed_auth_attempts(created_at DESC);

-- IP blocklist (manual and automatic blocks)
CREATE TABLE ip_blocklist (
    ip_address INET PRIMARY KEY,
    block_type VARCHAR(32) NOT NULL,  -- 'manual', 'auto_brute_force', 'auto_rate_limit', 'auto_abuse'
    reason VARCHAR(255),
    blocked_by VARCHAR(64) REFERENCES users(id),  -- NULL for automatic blocks
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- NULL for permanent blocks
    metadata JSONB
);

CREATE INDEX idx_ip_blocklist_type ON ip_blocklist(block_type);
CREATE INDEX idx_ip_blocklist_expires ON ip_blocklist(expires_at) WHERE expires_at IS NOT NULL;

-- Cleanup function for security data
CREATE OR REPLACE FUNCTION cleanup_security_data()
RETURNS void AS $$
BEGIN
    -- Remove old usage metrics (keep 30 days)
    DELETE FROM usage_metrics WHERE created_at < NOW() - INTERVAL '30 days';

    -- Remove old failed auth attempts (keep 7 days)
    DELETE FROM failed_auth_attempts WHERE created_at < NOW() - INTERVAL '7 days';

    -- Remove expired IP blocks
    DELETE FROM ip_blocklist WHERE expires_at IS NOT NULL AND expires_at < NOW();

    -- Archive old hourly stats (keep 90 days in main table)
    DELETE FROM usage_stats_hourly WHERE hour_bucket < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate IP reputation score
CREATE OR REPLACE FUNCTION calculate_ip_reputation(p_ip INET)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 100;
    v_failed_auths INTEGER;
    v_rate_limits INTEGER;
    v_suspicious INTEGER;
BEGIN
    -- Get current counts
    SELECT
        COALESCE(failed_auth_count, 0),
        COALESCE(rate_limit_hits, 0),
        COALESCE(suspicious_activity_count, 0)
    INTO v_failed_auths, v_rate_limits, v_suspicious
    FROM ip_reputation
    WHERE ip_address = p_ip;

    -- Deduct points for bad behavior
    v_score := v_score - (v_failed_auths * 5);   -- -5 per failed auth
    v_score := v_score - (v_rate_limits * 2);    -- -2 per rate limit hit
    v_score := v_score - (v_suspicious * 10);    -- -10 per suspicious activity

    -- Clamp to 0-100
    RETURN GREATEST(0, LEAST(100, v_score));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VeilChain Phase 6: Webhooks & Root History
-- ============================================

-- Root history (snapshots of root hash over time)
CREATE TABLE root_history (
    id VARCHAR(64) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    root_hash CHAR(64) NOT NULL,
    entry_count BIGINT NOT NULL,
    signature TEXT,                 -- Optional RSA signature of root hash
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_root_history_ledger ON root_history(ledger_id, created_at DESC);
CREATE INDEX idx_root_history_hash ON root_history(root_hash);

-- Trigger to append to root_history on ledger update
CREATE OR REPLACE FUNCTION record_root_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only record if root hash changed
    IF OLD.root_hash IS DISTINCT FROM NEW.root_hash THEN
        INSERT INTO root_history (id, ledger_id, root_hash, entry_count, created_at)
        VALUES (
            'rh_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '_' || substring(md5(random()::text) from 1 for 8),
            NEW.id,
            NEW.root_hash,
            NEW.entry_count,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_ledger_root_history
AFTER UPDATE ON ledgers
FOR EACH ROW EXECUTE FUNCTION record_root_history();

-- Webhooks table
CREATE TABLE webhooks (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(128),            -- HMAC secret for signature verification
    events VARCHAR(64)[] NOT NULL,  -- Array of event types: 'root_change', 'entry_append', etc.
    ledger_ids VARCHAR(64)[],       -- NULL = all ledgers, or array of specific ledger IDs
    is_active BOOLEAN DEFAULT TRUE,
    headers JSONB,                  -- Custom headers to include in webhook calls
    retry_config JSONB,             -- Custom retry configuration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active) WHERE is_active = TRUE;

CREATE TRIGGER update_webhooks_updated_at
BEFORE UPDATE ON webhooks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Webhook delivery attempts
CREATE TABLE webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    webhook_id VARCHAR(64) NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,    -- 'pending', 'success', 'failed', 'retrying'
    http_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Cleanup function for old webhook deliveries
CREATE OR REPLACE FUNCTION cleanup_webhook_deliveries()
RETURNS void AS $$
BEGIN
    -- Keep deliveries for 30 days
    DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VeilChain Phase 3: External Anchoring
-- ============================================

-- External anchors (timestamping to external chains/services)
CREATE TABLE anchors (
    id VARCHAR(64) PRIMARY KEY,
    ledger_id VARCHAR(64) NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
    root_hash CHAR(64) NOT NULL,           -- Root hash being anchored
    entry_count BIGINT NOT NULL,           -- Entry count at time of anchor
    anchor_type VARCHAR(32) NOT NULL,      -- 'bitcoin', 'ethereum', 'rfc3161', 'opentimestamps'
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- 'pending', 'confirmed', 'failed'

    -- External chain/service details
    external_tx_id VARCHAR(128),           -- Transaction ID on external chain
    external_block_height BIGINT,          -- Block height when confirmed
    external_block_hash VARCHAR(128),      -- Block hash for verification
    external_timestamp TIMESTAMPTZ,        -- Timestamp from external source

    -- Proof data
    proof_data JSONB,                      -- Merkle proof or inclusion proof from external chain

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX idx_anchors_ledger ON anchors(ledger_id, created_at DESC);
CREATE INDEX idx_anchors_status ON anchors(status) WHERE status = 'pending';
CREATE INDEX idx_anchors_type ON anchors(anchor_type);
CREATE INDEX idx_anchors_root_hash ON anchors(root_hash);

-- Anchor configurations (per-user settings for automatic anchoring)
CREATE TABLE anchor_configs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ledger_id VARCHAR(64) REFERENCES ledgers(id) ON DELETE CASCADE,  -- NULL = applies to all ledgers
    anchor_type VARCHAR(32) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,

    -- Trigger conditions
    trigger_on_entries INTEGER,            -- Anchor every N entries (e.g., every 100)
    trigger_on_interval INTERVAL,          -- Anchor every interval (e.g., '1 hour')

    -- External service credentials (encrypted)
    credentials JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_anchor_config UNIQUE (user_id, ledger_id, anchor_type)
);

CREATE INDEX idx_anchor_configs_user ON anchor_configs(user_id);
CREATE INDEX idx_anchor_configs_ledger ON anchor_configs(ledger_id);

CREATE TRIGGER update_anchor_configs_updated_at
BEFORE UPDATE ON anchor_configs
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
