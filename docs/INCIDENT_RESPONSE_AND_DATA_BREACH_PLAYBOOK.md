# Incident Response & Data Breach Playbook (IRP)
## ISO/IEC 27001:2022 Compliance Standard (Controls A.5.24 – A.5.28)
### Incorporating CERT-In 6-Hour & DPDP Act Data Breach Notification Mandates

**Document Reference**: PIFS-SOP-IRP-2026-V1  
**Classification**: Internal / Confidential  
**Standard**: ISO/IEC 27001:2022 (A.5.24 – A.5.28), NIST SP 800-61 Rev. 2  
**Effective Date**: 2026-10-27  
**Review Cycle**: Semi-Annual (tested via simulation drills every 6 months)  

---

## 1. Purpose & Incident Management Lifecycle

This playbook governs the detection, triage, containment, eradication, recovery, forensic preservation, and regulatory reporting of all cybersecurity incidents and personal data breaches affecting software, databases, APIs, cloud tenants, and employee devices.

The lifecycle strictly adheres to the 6-phase standard:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. PREPARATION  │ ──► │  2. DETECTION &  │ ──► │ 3. CONTAINMENT & │
│  (Tools, Roles)  │     │      TRIAGE      │     │    ISOLATION     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 6. POST-MORTEM & │ ◄── │   5. RECOVERY    │ ◄── │ 4. ERADICATION   │
│   LESSONS (RCA)  │     │   & VALIDATION   │     │   & FORENSICS    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 2. Incident Response Team (IRT) Roles & Contact Matrix (A.5.24)

| Role | Responsibility | Designation | Backup Role |
| :--- | :--- | :--- | :--- |
| **Incident Commander (IC)** | Directs entire response; makes containment and downtime calls. | Head of Information Security (CISO) | Chief Technology Officer |
| **Technical Lead** | Coordinates code inspection, log analysis, and system isolation. | Lead DevSecOps / Backend Lead | Principal Software Engineer |
| **Database Lead** | Inspects Postgres/Supabase/MSSQL logs, rotates secrets, verifies RLS. | Database Architect | Senior DBA |
| **Legal & Compliance Lead** | Drafts regulatory notices (CERT-In, DPDP Board, customers); assesses liability. | Data Protection Officer (DPO) | Legal Counsel |
| **Communications Lead** | Manages internal employee updates and public disclosures (if required). | VP of Operations | CEO / Managing Director |

---

## 3. Incident Severity Classification Matrix (A.5.25)

| Severity | Criteria & Impact | Response SLA | Reporting Mandate |
| :---: | :--- | :---: | :--- |
| **P1<br>(Critical)** | • Active PII / biometric data exfiltration.<br>• Compromise of master database credentials / service role key.<br>• Full system outage or ransomware attack affecting production. | **Immediate<br>(< 15 mins)** | • **CERT-In within 6 hours**.<br>• **DPDP Board within 72 hours**.<br>• Executive Sponsor alerted within 30 mins. |
| **P2<br>(High)** | • Exploitable vulnerability actively probed in production.<br>• Cross-tenant data leakage (single-tenant scope).<br>• Account takeover (ATO) of privileged admin account. | **< 1 Hour** | • Internal escalation to CISO.<br>• Regulatory notification evaluated within 6 hours. |
| **P3<br>(Medium)** | • Isolated malware detection on non-admin developer workstation.<br>• Failed brute-force attack blocked by rate limits.<br>• High-severity dependency CVE discovered without active exploit. | **< 4 Hours** | Logged internally; remediated in 24–48 hours. |
| **P4<br>(Low)** | • Phishing email reported and quarantined.<br>• Minor policy deviation without data exposure.<br>• Informational vulnerability scan warning. | **< 24 Hours** | Recorded in standard operational ticketing system. |

---

## 4. Technical Containment Playbooks (A.5.26)

### 🚨 Playbook 1: Master Credential / Service Role Key Exposure (P1)
**Scenario**: Supabase service role key, database connection string, or cloud access key is leaked in a public repository, log stream, or client bundle.

1. **Immediate Revocation (< 15 mins)**:
   - Access **Supabase Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **API** $\rightarrow$ Click **Rotate Service Role Key**.
   - If AWS / Cloudflare keys: Immediately deactivate the leaked Access Key ID in IAM.
2. **Purge Leaked History**:
   - If committed to Git: Force-rewrite commit history using `git-filter-repo` or BFG Repo-Cleaner. Do NOT just commit a deletion!
3. **Audit Key Usage in Cloud Logs**:
   - Query cloud audit logs for all operations performed with the compromised key during the exposure window:
     ```sql
     SELECT timestamp, event_message, auth_user_id, ip_address 
     FROM security_audit_logs 
     WHERE timestamp >= NOW() - INTERVAL '48 HOURS' 
     ORDER BY timestamp DESC;
     ```
4. **Deploy Updated Secrets**:
   - Update Vercel / Cloudflare / serverless environment variables with the newly generated secret.
   - Trigger emergency zero-downtime rebuild and invalidate CDN edge cache.

---

### 🚨 Playbook 2: Insecure Direct Object Reference (IDOR) & Unauthorized Data Exfiltration (P1)
**Scenario**: An attacker discovers an unshielded API route or missing Row-Level Security policy, querying unauthorized organization or employee KYC records.

1. **Immediate Route Severance (< 10 mins)**:
   - Deploy emergency Cloudflare WAF block rule on the vulnerable URI path or IP address.
   - Alternatively, toggle maintenance mode on the specific edge function.
2. **Emergency Database RLS Lock**:
   - Enable strict RLS immediately on the compromised table:
     ```sql
     ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
     DROP POLICY IF EXISTS "public_read_temp" ON public.<table_name>;
     CREATE POLICY "strict_tenant_isolation" ON public.<table_name>
       FOR ALL USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'super_admin');
     ```
3. **Forensic Scope Determination**:
   - Review HTTP access logs to determine exact count and identity of compromised records.
   - Extract affected UUIDs for DPDP notification list.

---

### 🚨 Playbook 3: Biometric Hardware Punch Tampering / MSSQL Sync Breach (P2)
**Scenario**: Unauthorized modification of biometric punch events in `dbo.DeviceLogs` or unexpected absent-wipe recalculation.

1. **Shield Trigger Verification**:
   - Verify that `dbo.trg_AttendanceLogs_RecalculateShield` is active on MSSQL:
     ```sql
     USE [etimetracklite1];
     SELECT name, is_disabled FROM sys.triggers WHERE name = 'trg_AttendanceLogs_RecalculateShield';
     ```
2. **Bridge Token Rotation**:
   - Revoke the existing sync bridge bearer token in Supabase.
   - Re-issue a unique token and update the local bridge service config.
3. **Log Reconciliation**:
   - Run audit reconciliation script between raw hardware punch logs and processed daily records to identify altered timestamps.

---

## 5. Forensic Evidence Collection & Chain of Custody (A.5.28)

To ensure admissibility for cyber forensics and legal proceedings:
1. **Never Reboot or Reimage Immediately**:
   - Volatile memory (RAM), open network sockets, and running process states must be preserved first.
2. **Cryptographic Hashing of Evidence**:
   - Generate SHA-256 checksums immediately upon exporting database audit logs, access logs, or disk snapshots:
     ```bash
     sha256sum production_access_log_20261027.json > evidence_checksum.txt
     ```
3. **Evidence Log Storage**:
   - Store all raw evidence in an immutable, write-once-read-many (WORM) cloud bucket with object lock enabled.

---

## 6. Statutory Notification Procedures & Templates

### 6.1 CERT-In Mandatory Cybersecurity Incident Reporting (6-Hour Deadline)
Under the Indian Information Technology Act (CERT-In Directions 2022), the following template must be transmitted to **incident@cert-in.org.in** within 6 hours of incident confirmation:

```email
To: incident@cert-in.org.in
Subject: CYBER SECURITY INCIDENT REPORT - PARADIGM INTEGRATED FACILITY SERVICES

1. Name of the Organisation: Paradigm Integrated Facility Services Private Limited
2. Contact Person: Head of Information Security / CISO (ciso@paradigm-ifs.com, +91-XXXXXXXXXX)
3. Date and Time of Incident Occurrence: [YYYY-MM-DD HH:MM UTC]
4. Date and Time of Detection: [YYYY-MM-DD HH:MM UTC]
5. Type of Incident: [Unauthorized Access / Data Exfiltration / Credential Exposure]
6. Affected Systems / IPs: [Production API / AWS / Supabase Cloud Endpoint]
7. Brief Description of Incident:
   [Provide factual summary of the event, vectors detected, and affected software component]
8. Immediate Containment Measures Taken:
   [Key rotation completed, IP blocked at WAF, Row-Level Security patch deployed]
9. Impact Assessment:
   [Number of user records affected, operational downtime duration]
10. Current Status: [Contained / Under Forensic Investigation / Normal Operations Restored]
```

---

### 6.2 DPDP Act 2023 Personal Data Breach Notification (72-Hour Deadline)
Transmitted to the **Data Protection Board of India** and affected Data Principals:

```email
Subject: NOTICE OF PERSONAL DATA BREACH - PARADIGM IFS

1. Nature and Category of Personal Data Breached:
   [e.g., Employee Name, Mobile Number, Shift Attendance Records - Note: No passwords or bank credentials affected]
2. Estimated Number of Data Principals Affected: [Number]
3. Likely Consequences of the Breach:
   [Low risk of identity theft; potential spam communication]
4. Measures Taken by Data Fiduciary to Mitigate Harm:
   [Vulnerability sealed, affected sessions invalidated, credentials rotated, system audited]
5. Recommendations for Affected Data Principals:
   [Enable MFA, verify recent login activity, ignore unsolicited contact requests]
6. Contact for Inquiries:
   Data Protection Officer (dpo@paradigm-ifs.com)
```

---

## 7. Post-Mortem & Blameless Root Cause Analysis (RCA) (A.5.27)

Within **72 hours** of closing any P1 or P2 incident, the Incident Commander must conduct a Blameless Post-Mortem with the engineering team.

### RCA Template Structure:
1. **Executive Summary**: High-level synopsis of incident duration, customer impact, and resolution.
2. **Timeline of Events (UTC)**:
   - `HH:MM` — Anomaly introduced (commit / deployment / scan probe).
   - `HH:MM` — Detection alert fired.
   - `HH:MM` — Incident Response Team convened.
   - `HH:MM` — Containment achieved.
   - `HH:MM` — Permanent fix deployed and verified.
3. **Root Cause Analysis (5 Whys Methodology)**:
   - Why did the data leak occur?
   - Why was the RLS policy missing?
   - Why did the CI pipeline not catch the missing policy?
4. **Corrective & Preventative Actions (CAPA)**:
   - Assign action items with designated owners and strict completion dates.
5. **Policy & Test Updates**:
   - Add new test cases to automated test suite and update `scripts/iso27001_audit_check.py` to prevent regression.

---

## 8. Playbook Approval & Sign-Off

| Role | Name | Title | Date | Status |
| :--- | :--- | :--- | :---: | :---: |
| **Incident Commander** | Security Lead | CISO / SecOps | 2026-10-27 | **Approved** |
| **Technical Lead** | Engineering Lead | CTO / Software Architect | 2026-10-27 | **Approved** |
| **Data Protection Officer** | Legal Lead | DPO / Compliance Officer | 2026-10-27 | **Approved** |
