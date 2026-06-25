#!/bin/bash
# Myhomework.uz — xavfsiz deploy skripti
# Ishlatish: bash deploy.sh
# Bu skript ma'lumotlarni saqlab, kodni yangilaydi

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${DB_PATH:-$APP_DIR/data/myhomework.db}"

echo "=== Myhomework.uz Deploy ==="
echo "Loyiha: $APP_DIR"
echo "DB joyi: $DB_PATH"

# 1. DB backup
if [ -f "$DB_PATH" ]; then
    BACKUP_DIR="$(dirname "$DB_PATH")/backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).db"
    cp "$DB_PATH" "$BACKUP_FILE"
    echo "Backup saqlandi: $BACKUP_FILE"
else
    echo "DB hali mavjud emas (yangi o'rnatish)"
fi

# 2. Kodni yangilash
cd "$APP_DIR"
git pull origin main

# 3. Dependencylarni yangilash
npm install --production

# 4. Serverni qayta ishga tushirish (PM2 ishlatilsa)
if command -v pm2 &> /dev/null; then
    pm2 restart myhomework 2>/dev/null || pm2 start server/index.js --name myhomework
    echo "PM2 restart qilindi"
else
    echo "Eslatma: Serverni qo'lda restart qiling"
fi

echo "=== Deploy muvaffaqiyatli ==="
echo "DB: $DB_PATH"
