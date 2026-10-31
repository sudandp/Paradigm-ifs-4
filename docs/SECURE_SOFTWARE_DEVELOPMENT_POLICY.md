# Secure Software Development Policy (SSDP)
## ISO/IEC 27001:2022 Compliance Standard (Controls A.8.25 – A.8.32)

**Document Reference**: PIFS-POL-SSDP-2026-V1  
**Applicability**: All Engineering, DevOps, QA, Product Teams, and External Contractors  
**Status**: Active / Mandatory  
**Review Cycle**: Annual  

---

## 1. Purpose & Scope

This policy establishes the mandatory security rules, procedures, and architectural principles required for designing, developing, testing, deploying, and maintaining software applications across the organization, in full alignment with **ISO/IEC 27001:2022 Control A.8.25 (Secure Development Life Cycle)**.

The scope covers:
- Web and mobile applications (React, Vite, TypeScript, Capacitor).
- Backend APIs, Edge Functions (Node.js, Deno, Supabase).
- Database layer (PostgreSQL, MSSQL, migrations, and Row-Level Security).
- CI/CD build and deployment pipelines (GitHub Actions, Vercel, Docker).

---

## 2. Core Security Architecture Principles (A.8.27)

All software architectures must adhere to five core defense principles:

1. **Zero Trust (Never Trust, Always Verify)**:
   - Every API endpoint and microservice must independently authenticate and authorize incoming requests.
   - Never rely on network-level perimeter security alone.
2. **Defense in Depth**:
   - Multiple independent security layers must exist (e.g., frontend input validation + edge middleware auth + database Row-Level Security).
3. **Principle of Least Privilege**:
   - Applications, microservices, and human operators must operate with the minimum system permissions necessary to perform their intended function.
   - Front-end clients must NEVER possess database administrative rights or service role keys.
4. **Fail Secure (Fail Closed)**:
   - When an unexpected error or exception occurs, the system must default to a deny/locked state rather than permitting unauthorized access.
5. **Separation of Concerns**:
   - Clear segregation between presentation, business logic, persistence, and audit logging layers.

---

## 3. Secure Development Life Cycle (SDLC) Phases (A.8.25)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. Requirements │ ──► │   2. Design &   │ ──► │  3. Secure Code  │
│  & Threat Model │     │  Architecture   │     │  Implementation │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 6. Operations & │ ◄── │ 5. Deployment & │ ◄── │  4. Security &   │
│   Monitoring    │     │   Release Gate  │     │ Vulnerability QA│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Phase 1: Requirements & Threat Modeling
- Every feature handling user authentication, payments, biometric data, or PII must undergo a **Threat Modeling** assessment before coding begins.
- Threat assessments must use the **STRIDE** methodology:
  - **S**poofing identity
  - **T**ampering with data
  - **R**epudiation
  - **I**nformation disclosure (privacy breach)
  - **D**enial of service
  - **E**levation of privilege

### Phase 2: Design & Data Protection (A.8.10, A.8.11, A.8.24)
- **Data in Transit**: Enforce TLS 1.3 encryption across all public web traffic and inter-service communication.
- **Data at Rest**: Sensitive data (KYC documents, Aadhaar, PAN, banking records) must be encrypted using AES-256.
- **Data Masking**: PII must be masked in log files, telemetry, and developer consoles.
- **Signed URL Access**: Files stored in private storage buckets must only be retrievable via short-lived signed URLs (maximum 15 minutes TTL).

### Phase 3: Secure Coding Standards (A.8.28 & OWASP Top 10:2025)

#### 3.1 Input Validation & Sanitization
- All client-submitted inputs (query parameters, JSON bodies, headers) must be validated against strict schemas (e.g., Zod, Joi, or TypeScript types).
- Use parameterized SQL queries or ORMs. **String concatenation in SQL queries is strictly prohibited.**
- Sanitize HTML outputs to neutralize Cross-Site Scripting (XSS). Direct usage of `innerHTML` or `dangerouslySetInnerHTML` is prohibited without sanitized approval.

#### 3.2 Secret Management & Zero Secrets in Source
- **Zero Secrets in Git**: No API keys, database credentials, JWT secrets, or private keys may ever be committed to git repositories.
- Use `.env.local` for local development (enforced in `.gitignore`).
- In Vite/React frontends, only non-sensitive public variables may be prefixed with `VITE_`.
- `SUPABASE_SERVICE_ROLE_KEY` or master database connection strings must NEVER be included in frontend code.

#### 3.3 Authentication & Session Security (A.8.5)
- Passwords must be hashed using industry-standard adaptive hashing algorithms (Argon2id or bcrypt with cost factor $\ge 12$).
- Passwords must require a minimum of 12 characters including uppercase, lowercase, numbers, and symbols.
- Implement brute-force protection: Rate limit login endpoints and lock accounts after 5 consecutive failed attempts for a minimum of 15 minutes.
- Session tokens must be stored securely (HTTP-only, Secure, SameSite=Strict cookies, or encrypted app storage).

#### 3.4 Authorization & Multi-Tenancy (A.8.3)
- Database tables must have **Row-Level Security (RLS)** enabled by default.
- Every SELECT, INSERT, UPDATE, and DELETE query must verify the user's role and organization ID to prevent Insecure Direct Object References (IDOR).
- Administrative actions (role elevation, payroll approval, policy editing) must verify caller authority on the server/database layer, never trusting client state.

---

## 4. Source Code Management & Review Gates (A.8.4, A.8.32)

1. **Repository Hygiene**:
   - `main` and `production` branches are protected. Direct pushes are disabled.
   - All code changes require an approved Pull Request (PR).
2. **Peer Review Rules**:
   - Every PR requires review and approval by at least one qualified senior engineer.
   - Code reviewers must explicitly verify:
     - Absence of hardcoded credentials.
     - Presence of authorization/RLS checks.
     - Error handling fails safely.
     - Unit / integration test coverage for modified logic.
3. **Commit Integrity**:
   - Developers must sign git commits using GPG or SSH keys.

---

## 5. Security Testing in Development (A.8.29)

Automated testing must be integrated into the CI/CD pipeline:
1. **Static Application Security Testing (SAST)**:
   - Automated scanners (e.g., ESLint security rules, Semgrep, SonarQube) run on every push.
2. **Software Composition Analysis (SCA)**:
   - Automated scans of third-party dependencies (`npm audit`, Snyk, Dependabot).
   - High or Critical vulnerabilities block deployment until patched or remediated.
3. **Vulnerability Remediation SLAs (A.8.8)**:
   - **Critical Vulnerability (CVSS 9.0–10.0)**: Remediated within 24 hours.
   - **High Vulnerability (CVSS 7.0–8.9)**: Remediated within 7 days.
   - **Medium Vulnerability (CVSS 4.0–6.9)**: Remediated within 30 days.

---

## 6. Environment Segregation (A.8.31, A.8.33)

1. **Three-Tier Environment Structure**:
   - **Development**: Local development environments with mock data.
   - **Staging / QA**: Identical architectural replica of production used for regression and security testing.
   - **Production**: Live customer environment.
2. **Data Sanitization**:
   - **Production customer data must NEVER be copied or restored into Development or Staging environments.**
   - Staging must use synthetically generated or anonymized data sets.

---

## 7. Security Logging & Audit Trails (A.8.15)

The application must maintain an immutable security audit log (`security_audit_logs`) capturing:
- Successful and failed authentication attempts.
- Password resets and MFA changes.
- Privileged role assignments and access revocations.
- Data export actions and bulk employee record access.
- Changes to shift policies, attendance records, or financial configurations.

**Logging Rules**:
- Log entries must record: `timestamp` (UTC ISO-8601), `actor_id`, `event_type`, `ip_address`, `user_agent`, `status`, and `target_resource`.
- Logs must NEVER record plaintext passwords, credit card numbers, auth tokens, or unmasked national IDs.

---

## 8. Incident Response & Bug Bounty (A.5.24 – A.5.28)

1. Anyone who discovers a potential security vulnerability must report it immediately to `security@paradigm-ifs.com`.
2. Exploiting security vulnerabilities for personal gain or unauthorized data retrieval is strictly prohibited.
3. Any confirmed production vulnerability or breach will trigger the Incident Response Plan (IRP) with root cause analysis (RCA) documented within 72 hours.

---

## 9. Policy Compliance & Enforcement

Failure to comply with this policy may result in revocation of system access, rejection of software deployments, and disciplinary action up to and including termination of employment or contract.
