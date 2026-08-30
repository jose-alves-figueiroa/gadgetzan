#!/usr/bin/env bash
# Daily backup (docs/agents/06-stack-and-deploy.md § Docker Compose):
# pg_dump the running `db` service into a mapped host directory. This is
# someone's only copy of their financial data — keep it simple and reliable
# rather than clever.
#
# Usage: ./scripts/backup.sh
# Schedule (crontab -e): 0 3 * * * cd /path/to/gadgetzan && ./scripts/backup.sh >> backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/gadgetzan-$TIMESTAMP.sql.gz"

docker compose exec -T db pg_dump -U gadgetzan gadgetzan | gzip > "$FILE"
echo "Backup salvo em $FILE ($(du -h "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name "gadgetzan-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
