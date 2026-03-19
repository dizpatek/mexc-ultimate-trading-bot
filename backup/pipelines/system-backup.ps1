# Master Backup Script for Matrix System
# This script creates a timestamped backup of critical configurations, schemas, and pipelines.

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupRoot = Join-Path $PSScriptRoot "archive"
$CurrentBackup = Join-Path $BackupRoot $Timestamp

# Create directories
New-Item -ItemType Directory -Force -Path $CurrentBackup | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $CurrentBackup "scripts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $CurrentBackup "pipelines") | Out-Null

Write-Host "🚀 Starting System Backup: $Timestamp" -ForegroundColor Cyan

# 1. Backup Core Schemas
Write-Host "📦 Backing up schemas..."
Copy-Item "..\..\scripts\schema.sql" (Join-Path $CurrentBackup "scripts\schema.sql") -ErrorAction SilentlyContinue
Copy-Item "..\..\scripts\add_user_indexes.sql" (Join-Path $CurrentBackup "scripts\add_user_indexes.sql") -ErrorAction SilentlyContinue

# 2. Backup Audit Pipelines
Write-Host "📦 Backing up audit pipelines..."
Copy-Item ".\audit-db.ts" (Join-Path $CurrentBackup "pipelines\audit-db.ts")
Copy-Item ".\audit-api.ts" (Join-Path $CurrentBackup "pipelines\audit-api.ts")

# 3. Collect System Stats (Optional)
$Stats = @"
Backup Date: $Timestamp
User OS: Windows
Project: MexC2026
Multi-User Audit: Completed
"@
$Stats | Out-File (Join-Path $CurrentBackup "backup_info.txt")

Write-Host "✅ Backup completed: $CurrentBackup" -ForegroundColor Green
Write-Host "Done."
