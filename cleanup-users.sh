#!/bin/bash

# Cleanup Users and Files Script
# This script clears all non-admin users and their uploaded files
# while preserving the admin user account

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Data paths
USERS_FILE="${SCRIPT_DIR}/data/users.json"
UPLOAD_HISTORY_FILE="${SCRIPT_DIR}/data/upload_history.json"
UPLOADS_DIR="${SCRIPT_DIR}/uploads"
BACKUPS_DIR="${SCRIPT_DIR}/backups/cleanup"

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_SUBDIR="${BACKUPS_DIR}/${TIMESTAMP}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}User Data Cleanup Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if files exist
if [ ! -f "$USERS_FILE" ]; then
    echo -e "${RED}Error: users.json not found at $USERS_FILE${NC}"
    exit 1
fi

if [ ! -f "$UPLOAD_HISTORY_FILE" ]; then
    echo -e "${RED}Error: upload_history.json not found at $UPLOAD_HISTORY_FILE${NC}"
    exit 1
fi

# Show current state
echo -e "${YELLOW}Current state:${NC}"
TOTAL_USERS=$(jq '. | length' "$USERS_FILE")
ADMIN_USERS=$(jq '[.[] | select(.role == "admin")] | length' "$USERS_FILE")
REGULAR_USERS=$((TOTAL_USERS - ADMIN_USERS))
TOTAL_FILES=$(jq '. | length' "$UPLOAD_HISTORY_FILE")

echo "  Total users: $TOTAL_USERS"
echo "  Admin users: $ADMIN_USERS"
echo "  Regular users: $REGULAR_USERS"
echo "  Total uploaded files: $TOTAL_FILES"
echo ""

if [ $REGULAR_USERS -eq 0 ] && [ $TOTAL_FILES -eq 0 ]; then
    echo -e "${GREEN}No data to clean. Only admin users exist and no files uploaded.${NC}"
    exit 0
fi

# Count physical files in uploads directory
if [ -d "$UPLOADS_DIR" ]; then
    PHYSICAL_FILES=$(find "$UPLOADS_DIR" -type f | wc -l)
    echo "  Physical files in uploads/: $PHYSICAL_FILES"
else
    PHYSICAL_FILES=0
    echo "  Physical files in uploads/: 0 (directory doesn't exist)"
fi
echo ""

# Confirmation prompt
echo -e "${YELLOW}WARNING: This will:${NC}"
echo "  1. Delete all $REGULAR_USERS non-admin user accounts"
echo "  2. Delete all $TOTAL_FILES file metadata records"
echo "  3. Delete all $PHYSICAL_FILES physical files from uploads/"
echo "  4. Keep admin user accounts intact"
echo ""
echo -e "${YELLOW}A backup will be created at: ${BACKUP_SUBDIR}${NC}"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${BLUE}Cleanup cancelled.${NC}"
    exit 0
fi

# Create backup directory
echo -e "${BLUE}Step 1: Creating backup...${NC}"
mkdir -p "$BACKUP_SUBDIR"

# Backup users.json
cp "$USERS_FILE" "${BACKUP_SUBDIR}/users.json.backup"
echo "  ✓ Backed up users.json"

# Backup upload_history.json
cp "$UPLOAD_HISTORY_FILE" "${BACKUP_SUBDIR}/upload_history.json.backup"
echo "  ✓ Backed up upload_history.json"

# Backup uploads directory if it exists and has files
if [ $PHYSICAL_FILES -gt 0 ]; then
    mkdir -p "${BACKUP_SUBDIR}/uploads"
    cp -r "$UPLOADS_DIR"/* "${BACKUP_SUBDIR}/uploads/" 2>/dev/null || true
    echo "  ✓ Backed up uploaded files"
fi

echo -e "${GREEN}Backup completed!${NC}"
echo ""

# Step 2: Filter out non-admin users
echo -e "${BLUE}Step 2: Removing non-admin users from database...${NC}"
jq '[.[] | select(.role == "admin")]' "$USERS_FILE" > "${USERS_FILE}.tmp"
mv "${USERS_FILE}.tmp" "$USERS_FILE"

# Count remaining users
REMAINING_USERS=$(jq '. | length' "$USERS_FILE")
echo "  ✓ Removed $REGULAR_USERS users"
echo "  ✓ Kept $REMAINING_USERS admin users"
echo ""

# Step 3: Clear upload history
echo -e "${BLUE}Step 3: Clearing file upload history...${NC}"
echo "[]" > "$UPLOAD_HISTORY_FILE"
echo "  ✓ Cleared $TOTAL_FILES file metadata records"
echo ""

# Step 4: Delete physical files
echo -e "${BLUE}Step 4: Deleting physical files from uploads/...${NC}"
if [ -d "$UPLOADS_DIR" ] && [ $PHYSICAL_FILES -gt 0 ]; then
    rm -rf "${UPLOADS_DIR}"/*
    echo "  ✓ Deleted $PHYSICAL_FILES files"
else
    echo "  ✓ No files to delete"
fi
echo ""

# Summary
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Cleanup completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Summary:"
echo "  • Removed $REGULAR_USERS non-admin users"
echo "  • Kept $REMAINING_USERS admin users"
echo "  • Cleared $TOTAL_FILES file metadata records"
echo "  • Deleted $PHYSICAL_FILES physical files"
echo ""
echo "Backup location: ${BACKUP_SUBDIR}"
echo ""
echo -e "${YELLOW}Note: To restore from backup, run:${NC}"
echo "  cp ${BACKUP_SUBDIR}/users.json.backup $USERS_FILE"
echo "  cp ${BACKUP_SUBDIR}/upload_history.json.backup $UPLOAD_HISTORY_FILE"
if [ $PHYSICAL_FILES -gt 0 ]; then
    echo "  cp -r ${BACKUP_SUBDIR}/uploads/* $UPLOADS_DIR/"
fi
echo ""
