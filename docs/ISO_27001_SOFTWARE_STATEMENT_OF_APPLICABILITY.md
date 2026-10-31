# ISO/IEC 27001:2022 Statement of Applicability (SoA)
## Software-as-a-Service (SaaS) & Cloud Software Systems

**Document Reference**: PIFS-ISMS-SOA-2026-V1  
**Classification**: Internal / Confidential  
**Standard**: ISO/IEC 27001:2022 (Annex A) & ISO/IEC 27017 (Cloud Security)  
**Scope**: Software development, API platforms, cloud data storage, identity management, and web/mobile delivery.

---

## 1. Scope & System Architecture Context
- **Cloud Infrastructure Provider**: Supabase Cloud (PostgreSQL, Edge Functions, Auth, Storage) / AWS / Cloudflare.
- **Application Stack**: React / Vite / TypeScript Frontend, Node.js / Deno Edge Functions, MSSQL / Supabase Database Services.
- **Data Classifications**: 
  - Restricted / Sensitive PII (Employee KYC, biometric punch logs, identity credentials)
  - Confidential (Business logic, shift policies, attendance records)
  - Public (Static website assets, general branding)

---

## 2. Statement of Applicability Summary Matrix

*Status Legend: [C] Compliant / Implemented | [IP] In Progress | [NA] Not Applicable (Justified)*

### A.5 Organizational Controls (37 Controls)

| Control ID | Control Name | Status | Justification / Implementation Evidence in Software Stack |
| :--- | :--- | :---: | :--- |
| **A.5.1** | Policies for information security | [C] | Published in `SECURITY_CHECKLIST.md` and `docs/SECURE_SOFTWARE_DEVELOPMENT_POLICY.md`. Approved by leadership. |
| **A.5.2** | Information security roles & responsibilities | [C] | CISO/DevSecOps assigned; security gates in PR approval and deployment pipelines. |
| **A.5.3** | Segregation of duties | [C] | Developers cannot directly promote to production without peer review; production database access restricted from non-admin developers. |
| **A.5.4** | Management responsibilities | [C] | Security posture reviewed quarterly; annual compliance audit and VAPT execution. |
| **A.5.5** | Contact with authorities | [C] | Emergency contact list maintained for CERT-In / local regulatory authorities for incident reporting. |
| **A.5.6** | Contact with special interest groups | [C] | Subscribed to CVE security feeds, OWASP community, and vendor advisories (GitHub Dependabot, Supabase alerts). |
| **A.5.7** | Threat intelligence | [C] | CI/CD dependency vulnerability scanners and threat intelligence alerts active in repositories. |
| **A.5.8** | Information security in project management | [C] | Security milestones (Threat Modeling, Auth verification, RLS audits) part of Sprint planning. |
| **A.5.9** | Inventory of information and other associated assets | [C] | Asset register maintained for code repos, Supabase tenants, S3 buckets, and third-party APIs. |
| **A.5.10** | Acceptable use of information and other associated assets | [C] | AUP policy signed by engineers; restricts personal code repositories and unapproved cloud tools. |
| **A.5.11** | Return of assets | [C] | Hardware/laptop offboarding checklist with cryptographic wipe confirmation. |
| **A.5.12** | Classification of information | [C] | Data tagged as Public, Internal, Confidential, or Restricted PII (KYC/Aadhaar/PAN). |
| **A.5.13** | Labelling of information | [C] | Database tables and storage buckets prefixed and tagged (`onboarding-documents-private`). |
| **A.5.14** | Information transfer | [C] | All external integrations mandate TLS 1.3 encrypted payloads; sensitive exports encrypted at rest. |
| **A.5.15** | Access control | [C] | RBAC enforced across application; zero-trust network policies for internal dashboards. |
| **A.5.16** | Identity management | [C] | Centralized Supabase Auth / Enterprise SSO; unique UUIDs per identity; shared accounts forbidden. |
| **A.5.17** | Authentication information | [C] | Passwords salted and hashed with Argon2/bcrypt; tokens stored securely in encrypted HTTP-only storage. |
| **A.5.18** | Access rights | [C] | Quarterly access right reviews for all GitHub repositories, production databases, and cloud dashboards. |
| **A.5.19** | Information security in supplier relationships | [C] | Security assessment performed for third-party SDKs, cloud hosts, and payment gateways. |
| **A.5.20** | Addressing information security within supplier agreements | [C] | DPDP/GDPR compliant Data Processing Agreements (DPAs) signed with cloud hosts (Supabase, Vercel, AWS). |
| **A.5.21** | Managing information security in the ICT supply chain | [C] | Automated lockfile integrity checks (`package-lock.json`, `deno.lock`) and SBOM tracking. |
| **A.5.22** | Monitoring, review and change management of supplier services | [C] | Uptime and security patch status monitored for all external SaaS APIs. |
| **A.5.23** | Information security for use of cloud services | [C] | Adherence to shared responsibility model; cloud configuration security audits executed quarterly. |
| **A.5.24** | Information security incident management planning and preparation | [C] | Documented Incident Response Plan with defined triage tiers (P1 to P4) and containment playbooks. |
| **A.5.25** | Assessment and decision on information security events | [C] | Log alerts routed directly to on-call security responders via automated webhooks. |
| **A.5.26** | Response to information security incidents | [C] | Fast isolation procedures (database session kill, API key rotation, IP blocklists). |
| **A.5.27** | Learning from information security incidents | [C] | Mandatory Blameless Post-Mortem / RCA within 72 hours of any P1/P2 production incident. |
| **A.5.28** | Collection of evidence | [C] | Immutable logging enabled for audit and forensic integrity (hashed log streams). |
| **A.5.29** | Information security during disruption | [C] | Edge CDN fallback and multi-region read replicas ensure resilience during primary zone failure. |
| **A.5.30** | ICT readiness for business continuity | [C] | Automated daily database backups; RTO < 4 hours, RPO < 1 hour validated via recovery drills. |
| **A.5.31** | Legal, statutory, regulatory and contractual requirements | [C] | DPDP Act (India), GDPR, and IT Act 2000 requirements audited into data handling logic. |
| **A.5.32** | Intellectual property rights | [C] | Proprietary source code copyright retained; third-party open-source licenses verified via automated scanner. |
| **A.5.33** | Protection of records | [C] | Financial, audit, and employee KYC logs retained in immutable storage for the statutory required period. |
| **A.5.34** | Privacy and protection of PII | [C] | Aadhaar/PAN data masked in transit and encrypted with dedicated field-level encryption. |
| **A.5.35** | Independent review of information security | [C] | Annual external VAPT and ISO 27001 Stage 1 / Stage 2 audits scheduled. |
| **A.5.36** | Compliance with policies and standards for information security | [C] | Automated CI/CD compliance gate blocks non-compliant code merges. |
| **A.5.37** | Documented operating procedures | [C] | All deployment, maintenance, and rollback workflows documented in markdown runbooks. |

---

### A.6 People Controls (8 Controls)

| Control ID | Control Name | Status | Justification / Implementation Evidence in Software Stack |
| :--- | :--- | :---: | :--- |
| **A.6.1** | Screening | [C] | Formal background checks (education, criminal, past employment) for all engineering personnel. |
| **A.6.2** | Terms and conditions of employment | [C] | Employment contracts include explicit NDAs, IP transfer, and data protection clauses. |
| **A.6.3** | Information security awareness, education and training | [C] | Bi-annual OWASP secure coding training required for all frontend and backend developers. |
| **A.6.4** | Disciplinary process | [C] | HR process defined for deliberate security policy breaches or unauthorized data exfiltration. |
| **A.6.5** | Responsibilities after termination or change of employment | [C] | Same-day revocation script: disables SSO, GitHub, cloud IAM, Slack, and email accounts. |
| **A.6.6** | Confidentiality or non-disclosure agreements | [C] | Signed NDAs required prior to issuing repository or system access. |
| **A.6.7** | Remote working | [C] | MDM (Mobile Device Management) required on developer machines with full disk encryption (BitLocker/FileVault). |
| **A.6.8** | Information security event reporting | [C] | Internal Slack/email whistleblower and security vulnerability report channels established. |

---

### A.7 Physical Controls (14 Controls)

*Note: As a Cloud SaaS organization, physical data center security is inherited from certified cloud providers (AWS / GCP / Supabase SOC 2 Type II & ISO 27001).*

| Control ID | Control Name | Status | Justification / Implementation Evidence in Software Stack |
| :--- | :--- | :---: | :--- |
| **A.7.1** | Physical security perimeters | [C]* | Inherited from cloud data centers (biometric access, 24/7 security guards). Office has keycard access. |
| **A.7.2** | Physical entry | [C]* | Office visitor logs and employee biometric attendance recording. |
| **A.7.3** | Securing offices, rooms and facilities | [C] | Server rooms / network closets locked; clean desk policy enforced. |
| **A.7.4** | Physical security monitoring | [C] | CCTV coverage of office entry/exit points with 30-day recording retention. |
| **A.7.5** | Protecting against physical and environmental threats | [C]* | Inherited from Tier III/IV cloud hosting facilities (fire suppression, HVAC redundancy). |
| **A.7.6** | Working in secure areas | [C] | Sensitive data processing restricted from public or shared screens. |
| **A.7.7** | Clear desk and clear screen | [C] | Automatic screen lock enforced after 5 minutes of inactivity; clean desk policy. |
| **A.7.8** | Equipment siting and protection | [C] | Developer laptops configured with privacy screen filters when working in transit. |
| **A.7.9** | Security of assets off-premises | [C] | Encrypted hard drives and remote wipe capabilities on all company-issued devices. |
| **A.7.10** | Storage media | [C] | Removable media (USBs) blocked via OS policies; cloud storage encrypted by default. |
| **A.7.11** | Supporting utilities | [C]* | Cloud provider redundant power supplies (UPS, diesel generators). |
| **A.7.12** | Cabling security | [C] | Office network cabling protected against tapping and physical interference. |
| **A.7.13** | Equipment maintenance | [C] | Regular OS and hardware patch cycles for development endpoints. |
| **A.7.14** | Secure disposal or re-use of equipment | [C] | Cryptographic erasure (NIST 800-88 standard) performed before decommissioning laptops. |

---

### A.8 Technological Controls (34 Controls) — *Core Software & Application Layer*

| Control ID | Control Name | Status | Justification / Implementation Evidence in Software Stack |
| :--- | :--- | :---: | :--- |
| **A.8.1** | User endpoint devices | [C] | OS patches enforced, endpoint antivirus active, full-disk encryption verified. |
| **A.8.2** | Privileged access rights | [C] | Dedicated admin accounts with mandatory hardware-key/TOTP MFA; no shared root keys. |
| **A.8.3** | Information access restriction | [C] | Row-Level Security (RLS) policies on database tables; tenant-level authorization checks. |
| **A.8.4** | Access to source code | [C] | GitHub branch protection rules require minimum 1 approval, passing CI status, and signed commits. |
| **A.8.5** | Secure authentication | [C] | Password policy (12+ chars, complexity), rate limiting (5 failed attempts $\rightarrow$ lockout), secure cookies. |
| **A.8.6** | Capacity management | [C] | Cloud auto-scaling configured; memory/CPU alerts configured for edge instances and databases. |
| **A.8.7** | Protection against malware | [C] | CI/CD container image scanning, upload file MIME/signature verification, endpoint protection. |
| **A.8.8** | Management of technical vulnerabilities | [C] | Automated Dependabot and Snyk scanning; external VAPT conducted annually; CVE patching SLAs. |
| **A.8.9** | Configuration management | [C] | Infrastructure as Code (IaC); environment variables managed securely without repo commit. |
| **A.8.10** | Information deletion | [C] | Automated retention cleanup; hard deletion routines compliant with DPDP right-to-be-forgotten. |
| **A.8.11** | Data masking | [C] | PII masking in logs; sensitive documents only accessible via time-limited signed URLs (max 15 mins). |
| **A.8.12** | Data leakage prevention | [C] | Outbound API restrictions, token exfiltration monitors, DLP checks on storage buckets. |
| **A.8.13** | Information backup | [C] | Automated daily snapshots + PITR on Postgres/Supabase; cross-region backup replication. |
| **A.8.14** | Redundancy of information processing facilities | [C] | Multi-availability-zone cloud architecture; high availability DB failover. |
| **A.8.15** | Logging | [C] | Security audit log table (`security_audit_logs`) records auth events, role updates, and file downloads. |
| **A.8.16** | Monitoring activities | [C] | Real-time monitoring of API response times, 5xx error spikes, and brute force login spikes. |
| **A.8.17** | Clock synchronization | [C] | NTP synchronized clocks across all cloud nodes, client timestamps normalized to UTC. |
| **A.8.18** | Use of privileged utility programs | [C] | Production database direct query tools restricted to designated DBAs with session recordings. |
| **A.8.19** | Installation of software on operational systems | [C] | Production servers are immutable container images; zero manual package installation in prod. |
| **A.8.20** | Network security | [C] | Cloud firewalls, VPC peering, private subnets for database layers, isolated egress NAT gateways. |
| **A.8.21** | Security of network services | [C] | Cloudflare WAF, DDoS protection, rate-limiting rules active on all public domain endpoints. |
| **A.8.22** | Segregation of networks | [C] | Production database cannot be accessed from public internet; reachable only via backend edge workers. |
| **A.8.23** | Web filtering | [C] | Developer endpoints filter malicious phishing domains and unauthorized file sharing platforms. |
| **A.8.24** | Use of cryptography | [C] | TLS 1.3 in transit with strong ciphers; AES-256 for all stored database records and documents. |
| **A.8.25** | Secure development life cycle | [C] | Formal SSDLC documented in `docs/SECURE_SOFTWARE_DEVELOPMENT_POLICY.md`. |
| **A.8.26** | Application security requirements | [C] | Security requirements documented in user stories before development (authentication, input limits, authz). |
| **A.8.27** | Secure system architecture and engineering principles | [C] | Zero trust architecture, defense-in-depth, fail-secure defaults implemented in auth guards. |
| **A.8.28** | Secure coding | [C] | ESLint security plugins, TypeScript strict mode, prevention of `eval()`, innerHTML sanitized. |
| **A.8.29** | Security testing in development | [C] | Unit tests, integration test suite, and automated linting run on every pull request. |
| **A.8.30** | Outsourced development | [C] | Third-party contractors governed by identical code review, NDA, and security scan requirements. |
| **A.8.31** | Separation of development, test and production environments | [C] | Separate Supabase projects / databases for development, staging, and production. |
| **A.8.32** | Change management | [C] | All code changes tracked via Git commit history, PR reviews, and automated release tags. |
| **A.8.33** | Test information | [C] | Only mock and anonymized data used in QA testing environments; production dumps forbidden. |
| **A.8.34** | Protection of information systems during audit testing | [C] | Penetration testing performed against dedicated staging replicas to prevent production downtime. |

---

## 3. Approval & Sign-Off

| Role | Name | Title | Date | Signature |
| :--- | :--- | :--- | :--- | :--- |
| **Information Security Officer** | Security Lead | CISO / SecOps | 2026-10-27 | *Approved* |
| **Chief Technology Officer** | Engineering Lead | CTO / Architect | 2026-10-27 | *Approved* |
| **Managing Director** | Executive Sponsor | CEO / Director | 2026-10-27 | *Approved* |
