# Paradigm Facility Management (FMS) Enterprise Productivity Dashboard
## Comprehensive 50-Point Production Implementation Plan

> **Target Standard**: Production-grade Enterprise Facility Management System (FMS).  
> **Key Domains**: Sites & Properties, Technical Manpower, Cost & Billing, Real-Time Productivity (MOM Actions, Notices, Events, Reminders, Escalations).  
> **Landing Page Experience**: Dynamic role-based landing page on web that automatically switches to the user's departmental dashboard while providing cross-functional productivity tools.

---

### Phase 1: Architecture & Departmental Landing Core (Points 1–5)

1. **Role-Based Dynamic Landing Router (`/dashboard` or `/home`)**
   - Automatically direct users upon web login to their designated departmental command center based on `user.role` and `user.department`:
     - Executive Management $\rightarrow$ `/dashboard/management`
     - HR & Manpower $\rightarrow$ `/dashboard/hr`
     - Finance & Accounts $\rightarrow$ `/dashboard/finance`
     - Back Office & Administration $\rightarrow$ `/dashboard/backoffice`
     - Site Operations & Engineering $\rightarrow$ `/dashboard/operations`
   - Provide a quick 1-click Department Switcher for multi-role admins and superusers.

2. **Unified Real-Time Metrics State Engine**
   - Implement a lightweight, reactive hook (`useEnterpriseDashboardMetrics`) connected to Supabase real-time channels with 60-second background polling fallback to prevent database overload.
   - Aggregate metrics per department with localized browser caching (`sessionStorage`) for instant load times under 200ms.

3. **Multi-Site & Cluster Filter Bar with Persistence**
   - Universal sticky header selector: filter by **All Sites**, **Site Clusters / Zones** (Hyderabad Central, Hitec City, Bangalore North, etc.), or specific site/property.
   - Saves selection in user profile and URL query parameters for bookmarkable and shareable views.

4. **Productivity Ticker & Urgent Action Banner**
   - Prominent top ribbon displaying critical facility alerts: SLA breaches, unassigned emergency snags, unverified biometric punches, upcoming lease renewals, and contract expirations.

5. **Theme & Compliance Consistency (Paradigm Green `#006B3F`)**
   - Strictly adhere to Paradigm Green `#006B3F` styling, clean status tokens (Emerald `#10B981`, Amber `#F59E0B`, Crimson `#EF4444`, Slate `#64748B`), and the unified compliance footer (`PageFooter.tsx`).

---

### Phase 2: Executive Management Command Center (Points 6–13)

6. **Site Portfolio & Property Health Index**
   - High-level operational readiness score (0–100%) calculated from PPM completion, snag resolution velocity, manpower deployment fulfillment, and client satisfaction.

7. **Contract & Revenue Run Rate Overview**
   - Total active facility contracts, Monthly Recurring Revenue (MRR), annualized contract value, and contracts approaching renewal within 30/60/90 days.

8. **Manpower Deployment & Shortage Heatmap**
   - Real-time comparison of sanctioned manpower vs. deployed manpower across all sites, highlighting critical security and technical deficit zones.

9. **Consolidated Billing vs. Collection Tracker**
   - Month-to-date billing vs. collections, Outstanding Days of Sales (DSO), and high-value payment delays (>45 days) requiring executive intervention.

10. **Executive Escalation Queue (P0 Incidents)**
    - Immediate visibility into site escalations: power outages, DG fuel runouts, major water leakages, elevator entrapments, or union/labor disputes.

11. **Site Compliance & Audit Scorecard**
    - Statutory compliance ratings across PF/ESI submissions, Fire NOC status, Lift safety licenses, and HT Yard electrical safety inspections.

12. **Client Sentiment & SLA Performance Gauge**
    - Net Promoter Score (NPS) / CSAT rating across residential vs. commercial societies, accompanied by First Response Time (FRT) and Mean Time to Resolution (MTTR).

13. **Executive Quick Action Hub**
    - One-click trigger for emergency site broadcasts, urgent vendor approvals, and bulk PDF report generation for board meetings.

---

### Phase 3: HR & Manpower Productivity Dashboard (Points 14–21)

14. **Daily Manpower Muster & Shift Attendance Gauge**
    - Live breakdown of Shift A (Morning), Shift B (Afternoon), Shift C (Night), and General Shift deployments against approved roster strengths.

15. **Biometric Punch Ingestion & Sync Health Bar**
    - Status of on-site biometric machines (eSSL / Hikvision / Mobile Face Ingestion), detecting offline devices and missed device logs within the last 15 minutes.

16. **Double Duty & Overtime (OT) Cost Exposure Meter**
    - Instant tally of double duty shifts (A+B, B+C, A+C at 2.0x) and accumulated overtime hours to prevent unauthorized wage ballooning.

17. **Weekly Off (`W/O`) Policy Compliance Engine**
    - Tracking the 6-day duty cycle and enforcement of the max 1 Weekly Off per calendar week rule to ensure labor law compliance.

18. **Pending Leave & On-Duty Approval Queue**
    - Streamlined inbox for pending site leave requests, comp-off credits, and field duty passes with supervisor approval timestamps.

19. **Recruitment & Attrition Pipeline Tracker**
    - Open site job requisitions, onboarding candidate pipeline (Doc Verification $\rightarrow$ Police Clearance $\rightarrow$ Uniform Issue $\rightarrow$ Site Allocation), and 30-day attrition rate.

20. **Statutory Document & ID Card Expiration Radar**
    - Early warnings for expiring security guard licenses (PSARA), driver licenses, medical fitness certs, and police verification reports.

21. **Uniform & Asset Issuance Ledger**
    - Inventory balance of guard uniforms, safety shoes, jackets, and walkie-talkies assigned to staff, highlighting unreturned items upon exit.

---

### Phase 4: Finance, Billing & Cost Management Dashboard (Points 22–29)

22. **Real-Time Billing Run-Rate & Invoice Generation Status**
    - Monthly billing progress: Draft $\rightarrow$ Approved $\rightarrow$ Sent to Client $\rightarrow$ Paid, segmented by Fixed Fee, Cost-Plus, and Reimbursable line items.

23. **Aging Accounts Receivable (AR) Breakdown**
    - Visual aging buckets: Current, 1–30 days, 31–60 days, 61–90 days, and 90+ days delinquent sites with designated client contact triggers.

24. **Site Profitability & Gross Margin Monitor**
    - Cost-to-serve analysis per property: Manpower wage cost + consumables + machinery depreciation vs. billed revenue to flag low-margin accounts.

25. **Diesel Generator (DG) & Energy Expense Reconciler**
    - EB units vs. DG fuel consumption logs, tracking diesel replenishment invoices and calculating cost per kWh generated to identify fuel leakage.

26. **Consumable & Chemical Procurement Burn Rate**
    - Housekeeping chemical stocks, restroom consumables, and hygiene product consumption vs. approved monthly site budget caps.

27. **Vendor Payment & AMC Contract Schedule**
    - Upcoming vendor liability calendar for lift AMC, chiller servicing, fire hydrant maintenance, and pest control subcontractors.

28. **Disputed Invoices & Deduction Management**
    - Track client penalty deductions (penalties for manpower shortage or SLA downtime) with dispute resolution notes and credit notes.

29. **Cash Flow & Site Petty Cash Ledger**
    - Balance tracking of supervisor petty cash reserves, emergency site maintenance floats, and digital expense voucher approvals.

---

### Phase 5: Back Office & Central Administration Dashboard (Points 30–36)

30. **Central Helpdesk & Omnichannel Ticket Dispatch**
    - Central ticket inbox aggregating resident/tenant complaints, categorised by Electrical, Plumbing, HVAC, Carpentry, and Security.

31. **Material Requisition & Purchase Order (PO) Approvals**
    - Back-office approval queue for site spare parts, replacement pumps, light fixtures, and cleaning equipment with multi-level sign-offs.

32. **Store & Warehouse Central Inventory View**
    - Real-time stock levels of critical backup equipment (submersible pumps, portable generators, safety harnesses) available for dispatch.

33. **Courier, Document & Legal File Tracking**
    - Inward and outward courier tracking for client agreements, bank guarantees, compliance audit folders, and statutory notices.

34. **Key & Access Card Management Register**
    - Digital audit trail of master keys, server room access cards, and facility badges checked out by technicians or contractors.

35. **Vendor Onboarding & Compliance Verification Desk**
    - Verification dashboard for 3rd-party contractors: GSTIN validation, MSME certs, insurance policies, and signed Non-Disclosure Agreements (NDAs).

36. **Facility Audit & Inspection Report Repository**
    - Repository of completed monthly facility review reports, energy audit filings, and joint site inspection sign-offs with resident associations.

---

### Phase 6: Site Operations & Property Engineering Dashboard (Points 37–43)

37. **Daily Site Supervisor Log & Shift Handover Diary**
    - Digital shift logbook where outgoing site supervisors record shift handovers, pending tasks, gate anomalies, and critical equipment status.

38. **Planned Preventive Maintenance (PPM) Calendar & Execution Rate**
    - Live tracking of daily/weekly/monthly PPM tasks (DG checks, transformer inspection, STP/WTP water quality tests, fire pump churn tests).

39. **Snag & Defect Resolution Velocity (Asset QR Tracking)**
    - Scan-to-report defect tracking for building fixtures, tracking time-from-detection to contractor assignment and final closure.

40. **STP/WTP Water Quality & Tank Level Monitor**
    - Daily parameter tracking for Sewage Treatment Plants (pH, TSS, COD, BOD) and water tank levels (Domestic, Overhead, Fire Reserve).

41. **HT Yard & Electrical Substation Daily Audit Checklist**
    - Electrical compliance telemetry: transformer oil temperature, VCB pressure gauges, capacitor bank power factor, and neutral earthing integrity.

42. **Visitor & Vehicle Traffic Density at Society Gates**
    - Real-time gate telemetry: visitor entries, cab/delivery vehicle dwell times, unregistered guest flags, and parking slot utilization.

43. **Emergency Drill & Fire Safety Readiness Index**
    - Status of fire extinguisher hydrostatic testing, smoke detector battery inspections, evacuation drill schedules, and ERT trained roster.

---

### Phase 7: Unified Productivity Ecosystem (MOM, Notices, Events, Reminders) (Points 44–50)

44. **MOM (Minutes of Meeting) Action-Item Execution Engine**
    - Structured MOM parser that extracts actionable tasks from meetings, assigns explicit owners, target resolution dates, and priority tags.
    - Integrated countdown timer showing days/hours remaining before action-item deadline with color-coded urgency.

45. **Departmental & Site-Wide Digital Notice Board**
    - Broadcast engine for publishing company announcements, safety advisories, shift roster updates, and client circulars.
    - Features read receipts, pinned announcements, and expiration date settings to keep the board clutter-free.

46. **Unified Operations & Corporate Events Calendar**
    - Master interactive calendar showing:
      - Site client review meetings
      - Statutory audit dates
      - Team training & tool-box talk sessions
      - National/Gazetted holidays per state
      - Staff birthdays and service anniversaries

47. **Smart Intelligent Reminders Hub**
    - Personal and team reminders with snooze, recurring recurrence (Daily, Weekly, Monthly), and automatic creation from system events (e.g., "Renew AMC for Sobha Lift in 7 days").

48. **Automated Escalation Matrix & Notification Dispatch**
    - Automatic multi-tier escalation (Supervisor $\rightarrow$ Ops Manager $\rightarrow$ VP Ops) for tickets or MOM items that cross SLA thresholds.
    - Multi-channel delivery: In-app banner, WhatsApp notification, and email alert.

49. **Individual Daily Productivity Scorecard & Checklist**
    - Role-tailored daily to-do checklist for staff (e.g., Morning Gate Audit, Check Water Meter, Verify Bio Punches, Send Daily Report).
    - Gamified productivity progress ring (0% to 100%) encouraging on-time task completion.

50. **Export & Executive Report Digest Generator**
    - One-click export to PDF, Excel, and WhatsApp-ready summaries for daily operational digests, weekly productivity reviews, and monthly client presentations.

---

### Implementation Phases & Milestones

| Stage | Milestone | Deliverables | Points Covered |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Foundation & Routing | Dynamic landing router, site filter bar, role switcher | Points 1–5 |
| **Stage 2** | Productivity Core | MOM Action Tracker, Notices Board, Events Calendar, Reminders | Points 44–50 |
| **Stage 3** | Operations & HR Dashboards | Site Engineering, PPM, Manpower Muster, Biometric Sync | Points 14–21, 37–43 |
| **Stage 4** | Finance & Back Office Dashboards | Billing tracker, AR aging, Helpdesk dispatch, PO approvals | Points 22–36 |
| **Stage 5** | Executive Command Center | Portfolio health index, run rate, consolidated audit scorecard | Points 6–13 |
