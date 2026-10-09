# Security Audit & Bug Bounty Review Plan

## Goal
Conduct a comprehensive defensive security audit and bug-bounty review of the Paradigm Office 4 application across frontend, backend serverless functions, Supabase RLS policies, MSSQL integrations, and mobile configurations to identify exploitable vulnerabilities and assign risk ratings without modifying application code.

## Tasks
- [ ] Task 1: Attack Surface & Route Inventory → Verify: Generate complete inventory table of all API endpoints (`api/*.ts`, `src/server.ts`), external hooks, and Supabase RPCs.
- [ ] Task 2: Credential & Secret Exposure Audit → Verify: Scan root directory, `.env*` templates, build scripts, client bundles, and `sarvam.key` to verify secrets are masked and not exposed in client bundles.
- [ ] Task 3: Backend & Serverless API Security Audit → Verify: Audit `api/view-file.ts`, `api/mssql.ts`, `api/cctv-proxy.ts`, `api/send-email.ts`, and `api/exotel-*.ts` for Path Traversal, SSRF, SQLi, and Missing Authentication.
- [ ] Task 4: Database & Supabase RLS Policy Audit → Verify: Inspect all migrations in `supabase/migrations/` for missing/permissive RLS policies, tenant leakage, and SECURITY DEFINER search_path flaws.
- [ ] Task 5: Authentication, RBAC & IDOR/BOLA Review → Verify: Trace user session flow, token management, role validation, and object-level permissions between frontend stores and backend endpoints.
- [ ] Task 6: Business Logic & Shift Engine Integrity Audit → Verify: Audit biometric punch ingestion, debouncing, shift assignment, double duty credit, and attendance correction logic against `shift-engine-rules.md` for tampering vectors.
- [ ] Task 7: Client-Side Security & Injection Vectors → Verify: Audit React components for DOM XSS sinks, unsafe HTML rendering, open redirects, CORS policies, and security headers.
- [ ] Task 8: Mobile (Capacitor/Android) & Dependency Vulnerability Review → Verify: Review `package.json` dependencies, Capacitor plugins, Android manifest permissions, and local storage/SQLite security.
- [ ] Task 9: OWASP Top 10 Assessment & Bug Bounty Report Synthesis → Verify: Compile findings into the mandatory 27-section report with CWEs, attack scenarios, CVSS-aligned severity, remediation, and final 0–100 security score.

## Done When
- [ ] All 27 required sections and OWASP Top 10 categories are systematically evaluated and documented.
- [ ] All identified vulnerabilities are classified with location, root cause, attack scenario, remediation, and verification steps while masking real secrets.
- [ ] Priority matrix and 0–100 Security Score are generated based on concrete code findings.
