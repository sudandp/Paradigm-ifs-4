# Information Asset Inventory & Third-Party Vendor Register
## ISO/IEC 27001:2022 Compliance Standard (Controls A.5.9 – A.5.13, A.5.19 – A.5.23)

**Document Reference**: PIFS-REG-ASSET-VENDOR-2026-V1  
**Classification**: Internal / Confidential  
**Standard**: ISO/IEC 27001:2022 (A.5.9, A.5.10, A.5.12, A.5.13, A.5.19 – A.5.23)  
**Effective Date**: 2026-10-27  
**Review Cycle**: Semi-Annual (Quarterly review of vendor compliance certifications)  

---

## 1. Information Classification Scheme (A.5.12, A.5.13)

All assets, data repositories, and digital records within the organization are classified into four tiers:

| Tier | Classification | Definition | Handling & Cryptographic Requirements |
| :---: | :--- | :--- | :--- |
| **C1** | **Restricted PII** | Sensitive employee & user data (Aadhaar, PAN, bank account details, biometric punches, KYC credentials). | • AES-256 encryption at rest.<br>• TLS 1.3 in transit.<br>• Row-Level Security (RLS) mandatory.<br>• Signed URLs only (15m max TTL).<br>• Masked in all logs and client views. |
| **C2** | **Confidential** | Proprietary source code, shift policies, pricing rules, system audit logs, API configurations, and database schemas. | • Access strictly restricted by RBAC.<br>• Private Git repositories & private cloud buckets.<br>• MFA required for all access. |
| **C3** | **Internal** | Operational runbooks, internal staff memos, meeting minutes, and onboarding guidelines. | • Accessible to all authenticated employees.<br>• Cannot be shared externally without NDA. |
| **C4** | **Public** | Marketing website, public company branding, app logos, and public documentation. | • Publicly accessible; integrity protected via CDN. |

---

## 2. Information Asset Inventory (A.5.9, A.5.10)

### 2.1 Cloud & Infrastructure Assets
| Asset ID | Asset Name | Description & Function | Hosting / Location | Data Tier | Asset Owner | Backup / Disaster Recovery |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **INF-01** | **Supabase Production DB** | Primary PostgreSQL database hosting employee records, shifts, and RLS policies. | AWS eu-central / ap-south | **C1 / C2** | Database Architect | Automated daily snapshots + PITR (7-day retention). |
| **INF-02** | **Supabase Storage Buckets** | Storage for KYC onboarding documents, certificates, and compliance files. | Supabase Cloud (S3-compatible) | **C1** | Database Architect | Cross-region bucket replication; private access only. |
| **INF-03** | **Edge Functions Environment** | Deno/Node.js serverless runtimes for authentication, notifications, and webhooks. | Supabase Edge Runtimes | **C2** | Backend Lead | Stateless; code versioned in protected Git repository. |
| **INF-04** | **Cloudflare WAF & DNS** | Edge CDN, DNS management, DDoS mitigation, and rate limiting. | Cloudflare Global Anycast Edge | **C2** | DevSecOps Lead | Cloudflare automated edge failover and cache purging. |
| **INF-05** | **Vercel Production Hosting** | Static application hosting and edge deployment for React/Vite frontends. | Vercel Global Edge Network | **C4 / C2** | Frontend Lead | Multi-region CDN deployment with instantaneous rollbacks. |

### 2.2 Software & Source Code Assets
| Asset ID | Asset Name | Description & Function | Repository / Host | Data Tier | Asset Owner | Security Controls |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **SFT-01** | **Paradigm Office Core Web App** | Main React/Vite web application for employee onboarding, CRM, and attendance. | GitHub (Private Repository) | **C2** | Frontend Lead | Branch protection on `main`; signed commits; PR approvals. |
| **SFT-02** | **Paradigm Mobile Client** | Capacitor/Android cross-platform application for field operations and punch recording. | GitHub (Private Repository) | **C2** | Mobile Lead | ProGuard code obfuscation; certificate pinning; no stored secrets. |
| **SFT-03** | **Attendance Engine & Shifting Rules** | Real-time shift computation engine (`shift-engine-rules.md`, multi-duty resolution). | Codebase / Edge Runtimes | **C2** | Principal Architect | Unit tested across 100% of shift edge cases; tamper-proof. |

### 2.3 Hardware & Endpoint Assets
| Asset ID | Asset Name | Description & Quantity | Location | Data Tier | Asset Owner | Security Controls |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **HWD-01** | **Developer Laptops** | Engineering and administrative workstations (macOS / Windows 11). | Office / Authorized Remote | **C2** | IT Administrator | Full disk encryption (BitLocker / FileVault); MDM; auto-lock (5 mins). |
| **HWD-02** | **eSSL Biometric Punch Devices** | Optical/capacitive fingerprint & facial recognition hardware at client sites. | Client Site Gates | **C1** | Operations Head | Physical tamper seals; isolated VLAN; sync bridge via token auth. |
| **HWD-03** | **Office Network & Gateways** | Corporate Wi-Fi access points and firewall routers. | Head Office | **C2** | Network Admin | WPA3 Enterprise; isolated guest network; admin MFA. |

---

## 3. Third-Party Supplier & Cloud Vendor Assessment (A.5.19 – A.5.23)

All third-party vendors and cloud providers processing company data must maintain current independent security certifications.

| Vendor ID | Vendor Name | Service Provided | Data Shared | Compliance Certifications Verified | Risk Level | DPA / BAA Signed? | Next Review Date |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **VND-01** | **Supabase Inc.** | Managed PostgreSQL, Auth, Object Storage, Edge Functions. | C1 (KYC, Auth, Punches), C2 (Configs) | **SOC 2 Type II, ISO 27001, HIPAA Compliant** | **High** | Yes (Enterprise DPA) | 2027-04-15 |
| **VND-02** | **Cloudflare Inc.** | WAF, DDoS Protection, DNS, Edge SSL/TLS Termination. | C2 (Encrypted network traffic metadata) | **ISO 27001, SOC 2 Type II, PCI-DSS Level 1** | **Medium** | Yes (Standard DPA) | 2027-03-01 |
| **VND-03** | **Vercel Inc.** | Frontend build, edge deployment, and hosting. | C4 (Bundled static code, zero secrets) | **SOC 2 Type II, ISO 27001** | **Low** | Yes (Standard Terms) | 2027-05-20 |
| **VND-04** | **GitHub (Microsoft)** | Source code repository hosting, CI/CD Actions, secret scanning. | C2 (Source code, commit history) | **SOC 1/2 Type II, ISO 27001, FedRAMP** | **High** | Yes (GitHub Enterprise) | 2027-06-10 |
| **VND-05** | **Exotel / Telephony Partner** | SMS and automated calling alerts for field staff. | C1 (Employee Mobile Numbers only) | **ISO 27001 Certified, TRAI Licensed** | **Medium** | Yes (Supplier Agreement) | 2027-02-15 |
| **VND-06** | **NPM Registry (GitHub)** | Node.js package distribution ecosystem. | C2 (Public dependencies imported) | **SLSA Level 3, 2FA Mandated** | **Medium** | Governed by Lockfile Integrity | Continuous (Automated) |

---

## 4. Vendor Offboarding & Contingency Strategy (A.5.22, A.5.23)

1. **Vendor Lock-In Mitigation**:
   - The primary database utilizes standard open-source **PostgreSQL** without proprietary extensions that prevent self-hosting.
   - If Supabase experiences an unrecoverable failure, the entire database schema, RLS policies, and data dumps can be restored into standard PostgreSQL on AWS RDS or GCP Cloud SQL within 4 hours.
2. **Vendor Termination Protocol**:
   - When offboarding any vendor:
     1. Revoke all API keys, webhook secrets, and service accounts.
     2. Request a formal **Certificate of Data Destruction** confirming complete purging of all customer data within 30 days.
     3. Verify log retention records for compliance audit history.

---

## 5. Review & Sign-Off

| Role | Name | Title | Date | Signature |
| :--- | :--- | :--- | :--- | :--- |
| **Asset Manager** | IT Lead | Head of IT Infrastructure | 2026-10-27 | *Approved* |
| **Vendor Risk Reviewer** | Security Lead | CISO / Compliance Lead | 2026-10-27 | *Approved* |
| **Executive Approver** | Engineering Lead | Chief Technology Officer | 2026-10-27 | *Approved* |
