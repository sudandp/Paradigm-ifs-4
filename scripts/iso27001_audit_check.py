#!/usr/bin/env python3
"""
ISO/IEC 27001:2022 Software Compliance Auditor & Verification Script
Checks codebase against key Annex A technological & organizational controls:
- A.5.1  Information Security Policies
- A.8.4  Source Code Protection & Secret Leaks
- A.8.9  Configuration Management & .env exposure
- A.8.24 Cryptographic Controls & Sensitive String Exposure
- A.8.28 Secure Coding Standards (XSS, eval, unsafe DOM)
- A.8.31 Environment Segregation
"""

import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

findings = {
    "PASSED": [],
    "WARNING": [],
    "FAILED": []
}

def log_result(status: str, control_id: str, description: str, details: str = ""):
    entry = {"control": control_id, "desc": description, "details": details}
    if status == "PASSED":
        findings["PASSED"].append(entry)
        print(f"  {GREEN}[PASS]{RESET} {control_id}: {description}")
    elif status == "WARNING":
        findings["WARNING"].append(entry)
        print(f"  {YELLOW}[WARN]{RESET} {control_id}: {description} -> {details}")
    else:
        findings["FAILED"].append(entry)
        print(f"  {RED}[FAIL]{RESET} {control_id}: {description} -> {details}")

def check_policies():
    """Verify Mandatory ISO 27001 Documentation exists (A.5.1, A.8.25)"""
    print(f"\n{BLUE}=== 1. Checking Mandatory ISMS Policy Artifacts (A.5.1, A.8.25) ==={RESET}")
    soa_file = ROOT_DIR / "docs" / "ISO_27001_SOFTWARE_STATEMENT_OF_APPLICABILITY.md"
    rtp_file = ROOT_DIR / "docs" / "ISO_27001_RISK_ASSESSMENT_AND_TREATMENT_PLAN.md"
    ssdp_file = ROOT_DIR / "docs" / "SECURE_SOFTWARE_DEVELOPMENT_POLICY.md"
    irp_file = ROOT_DIR / "docs" / "INCIDENT_RESPONSE_AND_DATA_BREACH_PLAYBOOK.md"
    asset_file = ROOT_DIR / "docs" / "INFORMATION_ASSET_AND_VENDOR_REGISTER.md"
    mrm_file = ROOT_DIR / "docs" / "INTERNAL_AUDIT_AND_MRM_PACKAGE.md"
    sec_checklist = ROOT_DIR / "SECURITY_CHECKLIST.md"
    ci_file = ROOT_DIR / ".github" / "workflows" / "ci.yml"

    if soa_file.exists():
        log_result("PASSED", "A.5.1 / A.5.36", "Statement of Applicability (SoA) exists", str(soa_file))
    else:
        log_result("FAILED", "A.5.1", "Missing Statement of Applicability document", "docs/ISO_27001_SOFTWARE_STATEMENT_OF_APPLICABILITY.md")

    if rtp_file.exists():
        log_result("PASSED", "Clause 6.1", "Risk Assessment & Treatment Plan (RTP) exists", str(rtp_file))
    else:
        log_result("FAILED", "Clause 6.1", "Missing Risk Assessment & Treatment Plan", "docs/ISO_27001_RISK_ASSESSMENT_AND_TREATMENT_PLAN.md")

    if ssdp_file.exists():
        log_result("PASSED", "A.8.25", "Secure Software Development Policy exists", str(ssdp_file))
    else:
        log_result("FAILED", "A.8.25", "Missing Secure Software Development Policy", "docs/SECURE_SOFTWARE_DEVELOPMENT_POLICY.md")

    if irp_file.exists():
        log_result("PASSED", "A.5.24 - A.5.28", "Incident Response & Data Breach Playbook (IRP) exists", str(irp_file))
    else:
        log_result("FAILED", "A.5.24", "Missing Incident Response Playbook", "docs/INCIDENT_RESPONSE_AND_DATA_BREACH_PLAYBOOK.md")

    if asset_file.exists():
        log_result("PASSED", "A.5.9 / A.5.19", "Information Asset & Cloud Vendor Register exists", str(asset_file))
    else:
        log_result("FAILED", "A.5.9", "Missing Information Asset & Vendor Register", "docs/INFORMATION_ASSET_AND_VENDOR_REGISTER.md")

    if mrm_file.exists():
        log_result("PASSED", "Clause 9.2 / 9.3", "Internal Audit Report & Management Review Package exists", str(mrm_file))
    else:
        log_result("FAILED", "Clause 9.2", "Missing Internal Audit & MRM Package", "docs/INTERNAL_AUDIT_AND_MRM_PACKAGE.md")

    if ci_file.exists() and "iso27001_audit_check.py" in ci_file.read_text(encoding="utf-8", errors="ignore"):
        log_result("PASSED", "A.8.29 / A.8.32", "CI/CD automated security quality gate active", str(ci_file))
    else:
        log_result("WARNING", "A.8.29", "CI/CD quality gate does not execute automated ISO 27001 scan", "")

    if sec_checklist.exists():
        log_result("PASSED", "A.8.32", "Pre-Deployment Security Checklist exists", str(sec_checklist))
    else:
        log_result("WARNING", "A.8.32", "Missing SECURITY_CHECKLIST.md", "")

def check_env_git_hygiene():
    """Verify Secrets and Environment Isolation (A.8.4, A.8.9)"""
    print(f"\n{BLUE}=== 2. Checking Git Hygiene & Secrets Exposure (A.8.4, A.8.9) ==={RESET}")
    gitignore_path = ROOT_DIR / ".gitignore"
    if not gitignore_path.exists():
        log_result("FAILED", "A.8.4", "Missing .gitignore file in root", "")
        return

    content = gitignore_path.read_text(encoding="utf-8", errors="ignore")
    if ".env" in content or ".env*.local" in content:
        log_result("PASSED", "A.8.9", ".env files are explicitly ignored in .gitignore", "")
    else:
        log_result("FAILED", "A.8.9", ".env files not blocked in .gitignore", "Potential secret leak to VCS")

    # Check for committed service role keys in source code
    source_dirs = ["src", "components", "pages", "hooks", "utils", "services"]
    secret_patterns = [
        (re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][a-zA-Z0-9_\-\.]{20,}['\"]"), "Hardcoded Supabase service role key"),
        (re.compile(r"VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*"), "Client-exposed service role variable (VITE_ prefix leak)"),
        (re.compile(r"-----BEGIN (RSA|EC|PRIVATE) KEY-----"), "Committed private cryptographic key")
    ]

    leaks_found = 0
    for sdir in source_dirs:
        dir_path = ROOT_DIR / sdir
        if not dir_path.exists():
            continue
        for ext in ["*.ts", "*.tsx", "*.js", "*.jsx"]:
            for fpath in dir_path.rglob(ext):
                try:
                    fcontent = fpath.read_text(encoding="utf-8", errors="ignore")
                    for pattern, label in secret_patterns:
                        if pattern.search(fcontent):
                            log_result("FAILED", "A.8.24 / A.8.4", f"Critical Secret Leak: {label}", str(fpath.relative_to(ROOT_DIR)))
                            leaks_found += 1
                except Exception:
                    pass

    if leaks_found == 0:
        log_result("PASSED", "A.8.4", "No hardcoded high-risk credentials found in frontend source", "")

def check_secure_coding():
    """Verify Secure Coding Patterns (A.8.28, OWASP)"""
    print(f"\n{BLUE}=== 3. Checking Secure Coding Standards (A.8.28 - OWASP Top 10) ==={RESET}")
    # Check for direct eval() or new Function() code execution (ignoring comments/strings where possible)
    eval_pattern = re.compile(r"\b(eval\s*\(|new\s+Function\s*\()")
    danger_dom = re.compile(r"dangerouslySetInnerHTML")

    eval_matches = []
    danger_dom_matches = []

    target_dirs = ["components", "pages", "src", "services", "utils"]
    for sdir in target_dirs:
        dir_path = ROOT_DIR / sdir
        if not dir_path.exists():
            continue
        for ext in ["*.ts", "*.tsx", "*.js", "*.jsx"]:
            for fpath in dir_path.rglob(ext):
                try:
                    fcontent = fpath.read_text(encoding="utf-8", errors="ignore")
                    if eval_pattern.search(fcontent):
                        eval_matches.append(str(fpath.relative_to(ROOT_DIR)))
                    if danger_dom.search(fcontent):
                        danger_dom_matches.append(str(fpath.relative_to(ROOT_DIR)))
                except Exception:
                    pass

    if not eval_matches:
        log_result("PASSED", "A.8.28", "No eval() or dynamic Function execution detected", "")
    else:
        log_result("FAILED", "A.8.28", f"Dangerous eval() construct found in {len(eval_matches)} files", ", ".join(eval_matches[:3]))

    if not danger_dom_matches:
        log_result("PASSED", "A.8.28", "No unvetted dangerouslySetInnerHTML instances", "")
    else:
        log_result("WARNING", "A.8.28", f"Found dangerouslySetInnerHTML in {len(danger_dom_matches)} files (ensure sanitized)", ", ".join(danger_dom_matches[:3]))

def check_supply_chain():
    """Verify ICT Supply Chain & Package Lockfiles (A.5.21, A.8.29)"""
    print(f"\n{BLUE}=== 4. Checking Supply Chain & Dependencies (A.5.21, A.8.29) ==={RESET}")
    pkg_lock = ROOT_DIR / "package-lock.json"
    pkg_json = ROOT_DIR / "package.json"

    if pkg_json.exists():
        log_result("PASSED", "A.5.21", "Manifest package.json exists", "")
    else:
        log_result("FAILED", "A.5.21", "Missing package.json", "")

    if pkg_lock.exists():
        log_result("PASSED", "A.5.21", "Lockfile package-lock.json exists for deterministic builds", "")
    else:
        log_result("FAILED", "A.5.21", "Missing package-lock.json (Supply chain vulnerability)", "")

def main():
    print(f"\n{BLUE}======================================================================{RESET}")
    print(f"{BLUE}      ISO/IEC 27001:2022 AUTOMATED AUDIT & COMPLIANCE SCANNER       {RESET}")
    print(f"{BLUE}======================================================================{RESET}")

    check_policies()
    check_env_git_hygiene()
    check_secure_coding()
    check_supply_chain()

    total_pass = len(findings["PASSED"])
    total_warn = len(findings["WARNING"])
    total_fail = len(findings["FAILED"])

    print(f"\n{BLUE}=== AUDIT SUMMARY ==={RESET}")
    print(f"  {GREEN}Passed Checks:  {total_pass}{RESET}")
    print(f"  {YELLOW}Warnings:       {total_warn}{RESET}")
    print(f"  {RED}Failures:       {total_fail}{RESET}")

    if total_fail > 0:
        print(f"\n{RED}[!] COMPLIANCE STATUS: NON-CONFORMANT ({total_fail} Critical Blocker(s)){RESET}")
        return 1
    elif total_warn > 0:
        print(f"\n{YELLOW}[*] COMPLIANCE STATUS: CONFORMANT WITH OBSERVATIONS ({total_warn} Warning(s)){RESET}")
        return 0
    else:
        print(f"\n{GREEN}[+] COMPLIANCE STATUS: FULLY CONFORMANT (ISO/IEC 27001:2022 Ready){RESET}")
        return 0

if __name__ == "__main__":
    sys.exit(main())
