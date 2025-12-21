# VeilChain Security Audit Checklist

This document provides a comprehensive security audit checklist for VeilChain deployments.

## Pre-Deployment Checklist

### Authentication & Authorization

- [ ] **JWT Configuration**
  - [ ] RS256 algorithm enforced (asymmetric)
  - [ ] Access token expiry ≤ 15 minutes
  - [ ] Refresh token rotation enabled
  - [ ] Token blocklist implemented
  - [ ] Private key stored in HSM/Vault

- [ ] **API Key Security**
  - [ ] Keys bcrypt hashed (cost factor ≥ 12)
  - [ ] Key prefix for quick lookup
  - [ ] Scoped permissions enforced
  - [ ] Key rotation reminders configured

- [ ] **OAuth Integration**
  - [ ] State parameter for CSRF protection
  - [ ] Token validation on callback
  - [ ] Secure callback URL (HTTPS only)

### Input Validation

- [ ] **Request Validation**
  - [ ] Maximum request size limits
  - [ ] Content-Type validation
  - [ ] JSON schema validation
  - [ ] Path traversal prevention

- [ ] **SQL Injection Prevention**
  - [ ] All queries parameterized
  - [ ] No dynamic SQL construction
  - [ ] Input sanitization layer

- [ ] **XSS Prevention**
  - [ ] Output encoding
  - [ ] CSP headers configured
  - [ ] No user content in scripts

### Cryptography

- [ ] **Hashing**
  - [ ] SHA-256 for Merkle tree
  - [ ] bcrypt for passwords (cost 12+)
  - [ ] HMAC-SHA256 for webhooks

- [ ] **Key Management**
  - [ ] Keys generated securely (crypto.randomBytes)
  - [ ] Keys never logged
  - [ ] Key rotation procedures documented

- [ ] **TLS Configuration**
  - [ ] TLS 1.3 or 1.2 only
  - [ ] Strong cipher suites
  - [ ] HSTS enabled
  - [ ] Certificate pinning (SDKs)

### Rate Limiting & DDoS Protection

- [ ] **Rate Limits**
  - [ ] Per-IP limits configured
  - [ ] Per-user limits configured
  - [ ] Write operations more restrictive
  - [ ] Burst allowance reasonable

- [ ] **Abuse Detection**
  - [ ] Anomaly detection active
  - [ ] IP reputation scoring
  - [ ] Automatic blocking enabled

### Logging & Monitoring

- [ ] **Audit Logging**
  - [ ] All API calls logged
  - [ ] Authentication events logged
  - [ ] Configuration changes logged
  - [ ] PII redacted from logs

- [ ] **Monitoring**
  - [ ] Prometheus metrics exposed
  - [ ] Critical alerts configured
  - [ ] Incident response plan ready

### Infrastructure

- [ ] **Database**
  - [ ] Append-only triggers active
  - [ ] Connection encryption (SSL)
  - [ ] Regular backups configured
  - [ ] Backup encryption enabled

- [ ] **Network**
  - [ ] Database not publicly accessible
  - [ ] Firewall rules audited
  - [ ] Internal services on private network

---

## Security Testing

### Automated Tests

```bash
# Run security-focused tests
npm run test:security

# Check dependencies for vulnerabilities
npm audit

# Lint for security issues
npm run lint:security
```

### Manual Testing Checklist

#### Authentication

- [ ] Test expired tokens rejected
- [ ] Test invalid signatures rejected
- [ ] Test revoked tokens rejected
- [ ] Test API key with wrong scope rejected
- [ ] Test rate limiting on login

#### Authorization

- [ ] Test cross-tenant access denied
- [ ] Test read-only key can't write
- [ ] Test scoped key respects ledger restrictions
- [ ] Test deleted user's tokens invalid

#### Input Validation

- [ ] Test oversized payloads rejected
- [ ] Test malformed JSON rejected
- [ ] Test SQL injection attempts logged
- [ ] Test path traversal attempts blocked

#### Merkle Tree Integrity

- [ ] Test proof verification catches tampering
- [ ] Test append-only enforcement
- [ ] Test hash consistency

---

## Penetration Testing

### Scope

- API endpoints (`/v1/*`)
- Authentication flows
- Public endpoints
- Webhook delivery

### Out of Scope

- DDoS attacks
- Social engineering
- Physical security

### Recommended Tools

- Burp Suite Pro
- OWASP ZAP
- sqlmap
- Nuclei
- Custom scripts for Merkle validation

---

## Compliance Mapping

### OWASP Top 10 (2021)

| Vulnerability | Status | Controls |
|--------------|--------|----------|
| A01:2021 Broken Access Control | ✅ | JWT + Permissions |
| A02:2021 Cryptographic Failures | ✅ | SHA-256, bcrypt, TLS 1.3 |
| A03:2021 Injection | ✅ | Parameterized queries |
| A04:2021 Insecure Design | ✅ | Threat modeling |
| A05:2021 Security Misconfiguration | ⚠️ | Checklist above |
| A06:2021 Vulnerable Components | ⚠️ | npm audit |
| A07:2021 Auth Failures | ✅ | Rate limiting, lockout |
| A08:2021 Data Integrity Failures | ✅ | Merkle tree + signatures |
| A09:2021 Security Logging | ✅ | Audit logs |
| A10:2021 SSRF | ✅ | Webhook URL validation |

### SOC 2 Type II

| Trust Principle | Controls |
|-----------------|----------|
| Security | Access control, encryption, audit logs |
| Availability | Monitoring, backups, DR plan |
| Confidentiality | Encryption, access control |
| Processing Integrity | Merkle tree, append-only |
| Privacy | PII redaction, GDPR compliance |

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Data breach, system compromise | 15 minutes |
| P2 | Service outage, security bypass | 1 hour |
| P3 | Degraded performance, failed auth | 4 hours |
| P4 | Minor issues, single user impact | 24 hours |

### Response Procedures

1. **Identify** - Confirm and classify incident
2. **Contain** - Limit damage (block IPs, revoke tokens)
3. **Eradicate** - Remove threat
4. **Recover** - Restore service
5. **Learn** - Post-mortem and improvements

### Emergency Contacts

| Role | Contact |
|------|---------|
| Security Lead | [TBD] |
| On-Call Engineer | [TBD] |
| Legal | [TBD] |

---

## Regular Audits

### Weekly

- Review security alerts
- Check failed authentication trends
- Review blocked IPs

### Monthly

- Dependency vulnerability scan
- Access review
- Key rotation check

### Quarterly

- Full security audit
- Penetration test
- Compliance review
- DR test

### Annually

- External security audit
- Threat model update
- Policy review
