# Paradigm IFS 4.0 - CRM Module Training & Technical Guide

This document provides a comprehensive overview of the CRM (Customer Relationship Management) module in Paradigm IFS 4.0. It is designed to serve as both an **Operational Training Manual** for business users (Sales Leads, Auditors, Operations) and a **Technical Reference** for developers and system administrators.

---

## 1. System Overview

The CRM module bridges the gap between sales prospecting and operational takeover. It tracks a lead from the first contact, through on-site auditing and dynamic cost estimations (quotations), all the way to converting the "Won" lead into an official active `Entity` (client site) in the ERP system.

### Key Features:
- **Kanban Pipeline:** Visual drag-and-drop pipeline tracking leads from 'New' to 'Won'.
- **Dynamic Site Surveys:** Customizable audit checklists with offline-first support for field agents.
- **Intelligent Quotation Engine:** Automated manpower calculation and statutory cost estimations.
- **Seamless Handover:** One-click conversion of a won lead into an operational site with all assets, compliance, and financial data mapped automatically.

---

## 2. End-User Guide (Role-Based Workflows)

### 2.1 For Business Leads & Sales Managers
**Goal:** Track prospects, manage follow-ups, and generate proposals.

1. **Lead Creation & Pipeline Management:**
   - Navigate to the **CRM Pipeline** dashboard.
   - Click **New Lead** to add a prospect. Fill in Client Details, Property Profile (Area, Units, Towers), and Current Vendors.
   - Use the **Kanban Board** to move leads through stages: *New Lead → Contacted → Site Visit Planned → Survey Completed → Proposal Sent → Negotiation → Won*.
2. **Follow-ups & Timeline:**
   - Inside a lead's detail page, click **New Entry** to log Calls, Meetings, WhatsApp chats, or Emails.
   - Set **Next Follow-up Dates** to track future actions. All actions are logged in the chronological timeline.
3. **Quotation Builder:**
   - Click **Build Proposal** from the lead's action menu.
   - Use the **Auto-Suggest** feature to populate the required manpower based on the property's size.
   - Define management fees, consumables, and GST. The system automatically calculates PF, ESI, Bonus, and Gratuity.
   - Click **Generate PDF** to export a formatted proposal for the client.

### 2.2 For Auditors & Field Officers
**Goal:** Conduct accurate physical property surveys, even in areas with no internet.

1. **Conducting Site Surveys:**
   - Open the lead on the mobile app and select **Property Survey**.
   - Fill out the structured questionnaire covering Infrastructure (Lifts, Pumps, STP), Asset Handover, Compliance (Labour Licenses), and Site Conditions.
   - **Offline-First Capability:** If you lose internet connection in a basement or remote site, a red **"Offline"** badge will appear. You can continue filling out the form. 
   - **Auto-Save:** The system secretly saves your progress every 5 seconds to the device's local storage. When you regain a connection, you can safely hit **Submit**.

### 2.3 For Operations & Site Managers
**Goal:** Take over the site once the contract is signed without re-entering data.

1. **Official Handover (Lead Conversion):**
   - Once a lead is marked as **Won**, a green **Convert to Project** button appears.
   - Clicking this triggers the automated handover engine (details in Section 3.3).
   - The prospect is immediately transformed into a live operational site (`Entity`), ready for staff deployment and attendance tracking.

---

## 3. Key Technical Highlights (Deep Dives)

### 3.1 Automatic Manpower Suggestion Algorithm
When building a quotation, sales teams can click **Auto-Suggest**. The system uses the property's profile (Area, Units, Floors, Towers, Amenities) to mathematically calculate the required staff:
- **Managers:** 1 per property (2 if units > 500).
- **Admin/Helpdesk:** 1 per 200 units.
- **Housekeeping (HK):** 1 HK staff per 15,000 sqft. 1 Supervisor per 8 HK staff.
- **Security:** 2 guards per tower entry, multiplied by 3 shifts (24/7 coverage). Splits ratio into 70% Male / 30% Female guards automatically.
- **Technicians:** 1 Electrician per 3 floors, 1 Plumber per 5 floors.
- **Specialized:** Adds 2 STP Operators if the property has a Sewage Treatment Plant.

### 3.2 Offline-First Survey Engine (Under the Hood)
The `SiteSurveyForm.tsx` is built for resilience:
1. **Network Listeners:** Uses `navigator.onLine` to detect real-time connectivity drops.
2. **Interval Caching:** A `setInterval` runs every 5 seconds, dumping the current JSON state of the survey into the browser/device `localStorage` using a key like `crm_survey_draft_{leadId}`.
3. **Restoration:** On page load, if a draft exists in local storage and the database shows no submitted survey, the UI auto-restores the draft.
4. **Syncing:** Hitting "Save Draft" or "Submit" while offline informs the user the data is safely cached. Once online, the submission pushes to the Supabase backend and clears the local cache.

### 3.3 The Conversion Engine (Lead → Entity)
When a user clicks **Convert to Project**, the `leadConversionService` executes a multi-step transformation mapping CRM data into the Operations database (`public.entities`):
1. **Basic Info Mapping:** Lead Name → Entity Name, Association Name → Billing Name, Lead Location → Entity Location.
2. **Infrastructure to Asset Tracking:** It scans the submitted Site Survey. If the auditor marked "Yes" for DG Generators, Lifts, or Pumps, these are automatically injected into the new Entity's `asset_tracking` JSON.
3. **Compliance Mapping:** Survey responses regarding PF/ESI registrations and Labour Licenses are mapped to the Entity's `compliance_details`.
4. **Financial Linkage:** The latest active quotation version is linked to the Entity for billing reference.
5. **Status Update:** The lead is marked as `Onboarding Started`, archiving it from active sales pipelines.

---

## 4. Developer Guide & Architecture

### 4.1 Database Schema (Supabase PostgreSQL)
The module relies on a relational architecture housed in `20260422_crm_module.sql`:
- **`crm_leads`**: Core prospect data, pipeline status, property metrics, and assignee links.
- **`crm_followups`**: Chronological log of interactions (Calls, Emails) tied to a lead.
- **`crm_checklist_templates`**: Admin-defined JSONB structures defining survey questions (allows dynamic surveys without DB migrations).
- **`crm_checklist_submissions`**: The actual survey responses (JSONB) linked to a lead.
- **`crm_quotations`**: Stores manpower line items (JSONB), total costs, margin percentages, and approval states.
- **`crm_statutory_masters`**: Global configuration for PF, ESI, Bonus rates, and minimum wage categories.
- **`audit_logs`**: Enterprise tracking of every create/update/status_change event for compliance.

### 4.2 State Management & API
- **Frontend State (Zustand):** `useCrmStore` (`store/crmStore.ts`) manages global state for leads, follow-ups, and UI filters (Kanban vs Table view). It provides optimistic UI updates for pipeline drag-and-drops.
- **API Layer (`services/crmApi.ts`):** 
  - Handles all Supabase queries.
  - Automatically translates `snake_case` DB columns to `camelCase` frontend variables using utility wrappers.
  - Injects `createAuditLog` calls automatically on data mutations.
- **Security (RLS):** 
  - Row Level Security (RLS) policies ensure authenticated users can only access leads within their organizational scope, while Operations managers gain read access during the handover phase.
