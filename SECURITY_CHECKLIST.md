# 🔒 Pre-Deployment Security Checklist

> Run through this before every deployment. No shortcuts.

---

## 1. Secrets & Credentials

- [ ] `.env.local` is in `.gitignore` and NOT in git history
- [ ] All API keys rotated since last known exposure
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `VITE_`
- [ ] No secrets in console.log statements
- [ ] No hardcoded passwords in source code (search for `'5687'`, `'admin'`, `'password'`)
- [ ] `.env.local.example` has placeholder values only

### How to Rotate Keys:
```bash
# 1. Supabase Dashboard → Settings → API → Rotate keys
# 2. Update .env.local with new values
# 3. Update Vercel Environment Variables
# 4. Redeploy
```

---

## 2. Authentication & Session

- [ ] Rate limiting active on login endpoints
- [ ] Account lockout after 5 failed attempts
- [ ] Session timeout configured (30 min inactivity)
- [ ] Refresh tokens encrypted in device storage
- [ ] No plaintext passwords stored anywhere
- [ ] Password reset invalidates old sessions

---

## 3. Authorization (RLS)

- [ ] All tables have RLS enabled (run `security_hardening_rls.sql`)
- [ ] Users can only read their own data
- [ ] Only admins can change roles
- [ ] `approve_user` RPC validates caller role
- [ ] No endpoint uses `service_role` key from client side

### Verify RLS is enabled:
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

## 4. File Storage

- [ ] Sensitive buckets are PRIVATE (onboarding-documents, compliance-documents)
- [ ] Only branding buckets are public (logo, background, avatars)
- [ ] File upload validates MIME type and size (10MB max)
- [ ] `/api/view-file` requires authentication
- [ ] Path traversal protection active (`..` blocked)
- [ ] Dangerous file extensions blocked (.exe, .bat, .ps1, etc.)

---

## 5. API & Infrastructure

- [ ] HTTPS enforced (HSTS header present)
- [ ] CSP header configured
- [ ] X-Frame-Options: DENY (clickjacking protection)
- [ ] X-Content-Type-Options: nosniff
- [ ] API routes return `no-store` cache headers
- [ ] CORS restricted to known origins
- [ ] Auth middleware is fail-closed (not fail-open)

---

## 6. Monitoring & Logging

- [ ] `security_audit_logs` table exists in database
- [ ] Login failures are logged with email and timestamp
- [ ] Account lockouts are logged
- [ ] Admin role changes are logged
- [ ] File access through `/api/view-file` is authenticated
- [ ] Session expirations are logged

### Check recent security events:
```sql
SELECT event_type, severity, user_email, timestamp 
FROM security_audit_logs 
ORDER BY timestamp DESC 
LIMIT 50;
```

---

## 7. Dependencies

- [ ] `npm audit` shows no critical vulnerabilities
- [ ] No unused dependencies in package.json
- [ ] All Supabase edge functions use latest SDK

### Run:
```bash
npm audit
npm audit fix
```

---

## 8. Debug Mode & Test Data

- [ ] No `console.log` with sensitive data
- [ ] No test accounts with known passwords
- [ ] No `debug_` files in production bundle
- [ ] Service worker recovery scripts are production-ready

---

## 9. Backup & Recovery

- [ ] Database backups running daily (via system-backup-manager)
- [ ] File storage backups configured
- [ ] Recovery procedure documented and tested
- [ ] Incident response contacts listed

---

## 10. Weekly Security Routine

| Day | Task |
|-----|------|
| Monday | Review `security_audit_logs` for anomalies |
| Tuesday | Check `npm audit` for new vulnerabilities |
| Wednesday | Review failed login patterns |
| Thursday | Verify new user/admin creation logs |
| Friday | Test backup restoration |

---

## Quick Commands

```bash
# Check for secrets in code
grep -rn "password\|secret\|api_key\|service_role" --include="*.ts" --include="*.tsx" src/ services/ utils/ | grep -v node_modules | grep -v ".agent"

# Check for dangerous patterns
grep -rn "eval(\|innerHTML\|dangerouslySetInnerHTML" --include="*.ts" --include="*.tsx" src/ | grep -v node_modules

# Verify .env is not tracked
git ls-files .env*
```
