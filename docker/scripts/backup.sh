#!/bin/sh
# VeilChain PostgreSQL Backup Script
#
# This script performs daily backups of the VeilChain database.
# Backups are stored with timestamps and old backups are automatically cleaned up.

set -e

# Configuration
BACKUP_DIR="/backup"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/veilchain_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup..."

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Perform backup
echo "[$(date)] Creating backup: ${BACKUP_FILE}"
pg_dump -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" --no-password | gzip > "${BACKUP_FILE}"

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    echo "[$(date)] Backup created successfully: $(du -h ${BACKUP_FILE} | cut -f1)"
else
    echo "[$(date)] ERROR: Backup failed or is empty"
    exit 1
fi

# Create latest symlink
ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"

# Clean up old backups
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "veilchain_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
echo "[$(date)] Current backups:"
ls -lh "${BACKUP_DIR}"/veilchain_*.sql.gz 2>/dev/null || echo "No backups found"

echo "[$(date)] Backup completed successfully"
