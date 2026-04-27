# Task: Bug Hunt and Fix for app.paradigmfms.com

## 📋 Status
- **Task ID**: `bug-hunt-app-paradigmfms`
- **Primary Agent**: `orchestrator`
- **Specialists**: `database-architect`, `frontend-specialist`, `security-auditor`
- **Priority**: High
- **Current State**: Phase 1 (Analysis & Discovery)

## 🎯 Objectives
1. Fix the `PGRST204` error: Missing `link` column in `notifications` table.
2. Resolve CSP violations for `assets.mixkit.co` and `api.ipify.org`.
3. Improve audio playback handling for notifications.
4. Verify general stability across Web, Android, and iOS.

## 🏗️ Technical Context
- **URL**: https://app.paradigmfms.com
- **Stack**: React, Vite, Capacitor, Supabase.
- **Identified Blocker**: Database schema mismatch in `notifications` table.

## 🗓️ Phase Breakdown

### Phase 1: Analysis & Discovery ⏳
- [x] Initial browser audit of `app.paradigmfms.com`.
- [ ] Locate `notifications` table definition in migrations and frontend stores.
- [ ] Locate CSP configuration (Vite, index.html, or Vercel config).
- [ ] Check for other database schema mismatches using `checklist.py`.

### Phase 2: Implementation (Fixes) ⏳
- [ ] **Database**: Create migration to add `link` column to `notifications` or update frontend to remove requirement.
- [ ] **Frontend**: Update `Content-Security-Policy` to whitelist required domains.
- [ ] **Frontend**: Implement user-interaction-based audio unlocking or better error handling for audio blocks.

### Phase 3: Verification & Audit ⏳
- [ ] Run `python .agent/scripts/verify_all.py . --url https://app.paradigmfms.com`.
- [ ] Manual verification via browser subagent.
- [ ] Check Android/iOS native logs for similar issues.

## 🔗 References
- Architecture: [.agent/ARCHITECTURE.md](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/.agent/ARCHITECTURE.md)
- Security Checklist: [SECURITY_CHECKLIST.md](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/SECURITY_CHECKLIST.md)
