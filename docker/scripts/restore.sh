#!/bin/sh
# VeilChain PostgreSQL Restore Script
#
# This script restores a VeilChain database backup.
# Usage: ./restore.sh [backup_file]
#        If no file specified, uses the latest backup.

set -e

# Configuration
BACKUP_DIR="/backup"
BACKUP_FILE="${1:-${BACKUP_DIR}/latest.sql.gz}"

echo "[$(date)] VeilChain Database Restore"
echo "=========================================="

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[$(date)] ERROR: Backup file not found: ${BACKUP_FILE}"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/veilchain_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

echo "[$(date)] Backup file: ${BACKUP_FILE}"
echo "[$(date)] Size: $(du -h ${BACKUP_FILE} | cut -f1)"
echo ""

# Confirm restore
echo "WARNING: This will DROP and recreate the database!"
echo "All existing data will be lost."
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
    echo "[$(date)] Restore cancelled"
    exit 0
fi

echo ""
echo "[$(date)] Starting restore..."

# Terminate existing connections
echo "[$(date)] Terminating existing connections..."
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${PGDATABASE}'
    AND pid <> pg_backend_pid();
" || true

# Drop and recreate database
echo "[$(date)] Dropping and recreating database..."
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "DROP DATABASE IF EXISTS ${PGDATABASE};"
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "CREATE DATABASE ${PGDATABASE} OWNER ${PGUSER};"

# Restore backup
echo "[$(date)] Restoring backup..."
gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" --no-password

echo "[$(date)] Restore completed successfully!"
echo ""

# Verify restore
echo "[$(date)] Verification:"
psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
    SELECT
        (SELECT COUNT(*) FROM ledgers) as ledgers,
        (SELECT COUNT(*) FROM entries) as entries,
        (SELECT COUNT(*) FROM users) as users;
"
