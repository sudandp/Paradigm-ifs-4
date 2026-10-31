# ISO/IEC 27001:2022 Information Security Risk Assessment & Treatment Plan (RTP)
## Software-as-a-Service (SaaS), APIs & Cloud Infrastructure

**Document Reference**: PIFS-ISMS-RTP-2026-V1  
**Classification**: Internal / Confidential  
**Standard**: ISO/IEC 27001:2022 (Clause 6.1.2 & Clause 6.1.3)  
**Effective Date**: 2026-10-27  
**Review Cycle**: Semi-Annual (or following major architecture / infrastructure changes)  

---

## 1. Methodology & Risk Scoring Matrix (Clause 6.1.2)

Risk is evaluated quantitatively based on the formula:
$$\text{Risk Score} = \text{Likelihood (1–5)} \times \text{Impact (1–5)}$$

### 1.1 Likelihood Scale (L)
| Level | Rating | Definition / Frequency |
| :---: | :--- | :--- |
| **1** | Rare | Highly unlikely; could occur only in exceptional circumstances (< once per 3 years). |
| **2** | Unlikely | Not expected, but plausible under rare technical conditions (once per 1–2 years). |
| **3** | Possible | Might occur at some point; common attack vector without target focus (1–2 times per year). |
| **4** | Likely | Easily exploitable; frequent vulnerability trend in modern web apps (multiple times per year). |
| **5** | Almost Certain | Actively probed; continuous automated scanning across internet facing assets (weekly/monthly). |

### 1.2 Impact Scale (I)
| Level | Rating | Definition (CIA, Legal, Financial, Operational) |
| :---: | :--- | :--- |
| **1** | Insignificant | Minor internal glitch; no customer data exposed; negligible financial loss (< ₹10,000). |
| **2** | Minor | Localized service degradation; non-sensitive data leak; minimal financial impact (< ₹1,00,000). |
| **3** | Moderate | Partial downtime (< 2 hrs); internal employee records exposed; moderate regulatory reporting. |
| **4** | Major | Critical platform outage (> 4 hrs); customer PII / biometric breach; regulatory fines (DPDP / CERT-In). |
| **5** | Catastrophic | Full database compromise / ransomware; catastrophic brand damage; severe legal liabilities. |

### 1.3 Risk Evaluation Matrix & Action Thresholds

```
   IMPACT ──►
L   1        2        3        4        5
▼ ┌────────┬────────┬────────┬────────┬────────┐
5 │ Low 5  │ Med 10 │ High 15│ Crit 20│ Crit 25│
4 │ Low 4  │ Med 8  │ Med 12 │ High 16│ Crit 20│
3 │ Low 3  │ Low 6  │ Med 9  │ High 12│ High 15│
2 │ Low 2  │ Low 4  │ Low 6  │ Med 8  │ Med 10 │
1 │ Low 1  │ Low 2  │ Low 3  │ Low 4  │ Low 5  │
  └────────┴────────┴────────┴────────┴────────┘
```

| Severity Tier | Risk Score | Mandatory Action Required |
| :--- | :---: | :--- |
| **Critical** | **17 – 25** | **Immediate Blocker**: Must remediate immediately (< 24 hrs). System deployment halted. |
| **High** | **12 – 16** | **High Priority**: Corrective action plan implemented within 7–14 days. |
| **Medium** | **7 – 11** | **Controlled**: Managed via standard sprint planning and monitoring (30–60 days). |
| **Low** | **1 – 6** | **Acceptable**: Residual risk accepted; review annually. |

---

## 2. Risk Assessment & Treatment Register (RTP)

*Legend: Inh = Inherent Risk (Before Controls) | Res = Residual Risk (After Controls) | Status: [M] Mitigated, [T] Transferred, [A] Accepted*

| Risk ID | Risk Description & Threat Vector | Asset / Surface | Inh (L×I) | Inh Score | Treatment Strategy & Annex A Controls | Res (L×I) | Res Score | Risk Owner | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: | :--- | :---: |
| **R-01** | **Cross-Tenant Data Exposure / IDOR**: Insecure direct object reference allows malicious users to query another organization's records. | Supabase DB / PostgreSQL | 4 × 5 | **20 (Crit)** | **Mitigate (A.8.3, A.8.27)**: Mandatory Row-Level Security (RLS) on all tables; auth session validation in RPCs; automated tenant isolation unit tests. | 1 × 4 | **4 (Low)** | Backend Lead | [M] |
| **R-02** | **Master Credential / Service Role Leak**: Exposure of `SUPABASE_SERVICE_ROLE_KEY` or master DB strings via git commits or client bundle. | Git Repo / Web Client | 4 × 5 | **20 (Crit)** | **Mitigate (A.8.4, A.8.9, A.8.24)**: Strict `.env*` exclusion in `.gitignore`; client bundle scanner (`scripts/iso27001_audit_check.py`); pre-commit hooks; KMS secret management. | 1 × 4 | **4 (Low)** | DevSecOps Lead | [M] |
| **R-03** | **Software Supply Chain Tampering (OWASP A03)**: Malicious code injected through compromised third-party npm / Deno dependencies. | CI/CD & Dependencies | 4 × 4 | **16 (High)** | **Mitigate (A.5.21, A.8.29)**: Mandatory lockfile verification (`package-lock.json`); automated Dependabot / Snyk scanning; monthly `npm audit fix` reviews. | 2 × 3 | **6 (Low)** | DevSecOps Lead | [M] |
| **R-04** | **Biometric Sync & Attendance Tampering**: Manipulation of raw hardware punches or inadvertent overwrite via eTimeTrackLite recalculated absent wipes. | MSSQL Bridge & Device Logs | 3 × 4 | **12 (High)** | **Mitigate (A.8.20, A.8.24)**: Deploy `trg_AttendanceLogs_RecalculateShield` trigger; 5-minute punch debouncing; API token authentication between bridge and Supabase. | 1 × 3 | **3 (Low)** | Systems Architect | [M] |
| **R-05** | **Employee KYC & PII Data Exfiltration**: Unauthorized access to Aadhaar cards, PAN numbers, bank details, or background checks. | Cloud Storage & API | 4 × 5 | **20 (Crit)** | **Mitigate (A.5.34, A.8.10, A.8.11)**: Private storage buckets; short-lived signed URLs (15m max TTL); log data masking; field-level AES-256 encryption. | 1 × 4 | **4 (Low)** | CISO / DPO | [M] |
| **R-06** | **Credential Stuffing & Brute Force Attacks**: Automated credential attacks on admin / employee login portal leading to Account Takeover (ATO). | Auth Service / Login UI | 4 × 4 | **16 (High)** | **Mitigate (A.8.5)**: Rate-limiting on `/auth` routes; account lockout after 5 failed attempts; Argon2/bcrypt hashing; MFA for privileged roles. | 2 × 3 | **6 (Low)** | Frontend Lead | [M] |
| **R-07** | **Cloud Outage & Irrecoverable Data Loss**: Primary cloud region hardware failure or database corruption resulting in service loss. | Cloud DB & Infrastructure | 3 × 5 | **15 (High)** | **Mitigate / Transfer (A.8.13, A.8.14)**: Automated daily backups with Point-In-Time Recovery (PITR); cross-region snapshot replication; cloud SLA (Supabase/AWS). | 1 × 4 | **4 (Low)** | Cloud Infrastructure Lead | [M] |
| **R-08** | **Client-Side Code Injection (XSS / Eval RCE)**: Injection of malicious scripts via user inputs or dynamic execution constructs. | Frontend Web App | 3 × 4 | **12 (High)** | **Mitigate (A.8.28)**: Ban on `eval()` and dynamic `new Function()`; AST-based safe math parsing; React auto-escaping; strict CSP headers. | 1 × 3 | **3 (Low)** | Frontend Lead | [M] |
| **R-09** | **Insider Privilege Escalation**: Unauthorized role escalation (e.g., standard employee modifying their role to Super Admin). | Database & Auth RPCs | 3 × 5 | **15 (High)** | **Mitigate (A.5.3, A.8.2)**: Server-side caller role checks in RPCs (`approve_user`); database triggers preventing direct `role` column mutation; immutable audit logs. | 1 × 4 | **4 (Low)** | Database Architect | [M] |
| **R-10** | **Delayed Incident Detection & Regulatory Breach**: Undetected security breach violating the CERT-In 6-hour or DPDP 72-hour reporting mandate. | Monitoring & Logging | 3 × 5 | **15 (High)** | **Mitigate (A.5.24 – A.5.28)**: Centralized `security_audit_logs`; real-time Slack/email webhook alerting on anomalous events; documented Incident Response Plan. | 1 × 3 | **3 (Low)** | Security Lead | [M] |

---

## 3. Residual Risk Profile Summary

Following the application of the defined ISO 27001:2022 Annex A technical and organizational controls:

```
Inherent Risk Profile:
  [CRITICAL]  4 Risks  (40%)  ████████████████
  [HIGH]      6 Risks  (60%)  ████████████████████████
  [MEDIUM]    0 Risks   (0%)
  [LOW]       0 Risks   (0%)

Residual Risk Profile (Post-Mitigation):
  [CRITICAL]  0 Risks   (0%)
  [HIGH]      0 Risks   (0%)
  [MEDIUM]    0 Risks   (0%)
  [LOW]      10 Risks (100%)  ████████████████████████████████████████
```

> **ISO 27001 Auditor Note**: All critical and high inherent risks have been systematically reduced to an **acceptable residual risk level ($\le 6$)** through documented technical controls and automated enforcement scripts.

---

## 4. Risk Treatment Plan (RTP) Execution Schedule

| Quarter | Focus Area | Verification Milestone | Owner |
| :---: | :--- | :--- | :--- |
| **Q1** | **Access & RLS Hardening** | Verify 100% of public schema tables enforce RLS; execute penetration tests against API endpoints. | Database Architect |
| **Q2** | **Supply Chain & Dependencies** | Audit lockfile versions; update edge functions; enforce automated CI/CD dependency vulnerability scans. | DevSecOps Lead |
| **Q3** | **Disaster Recovery & Backup Drills** | Execute a full database restore simulation from point-in-time snapshots; verify RTO < 4 hrs, RPO < 1 hr. | Cloud Infrastructure Lead |
| **Q4** | **Annual Risk Re-Assessment & VAPT** | Engage external CERT-In certified auditor for comprehensive Web & Mobile Application VAPT. | CISO / SecOps |

---

## 5. Review & Approval (Clause 6.1.3)

This Risk Assessment & Treatment Plan has been reviewed, evaluated against corporate risk appetite, and approved by the leadership team:

| Designee | Name | Designation | Date | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Risk Assessor** | Security Lead | Head of Information Security | 2026-10-27 | **Approved** |
| **System Owner** | Engineering Lead | Chief Technology Officer (CTO) | 2026-10-27 | **Approved** |
| **ISMS Sponsor** | Executive Sponsor | Managing Director / CEO | 2026-10-27 | **Approved** |
