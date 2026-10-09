/**
 * Local Assistant Service for Paradigm Assist
 * Handles real-time on-device operational queries (Clock, Date, Shift Engine, Math)
 * with zero network latency and 100% offline availability.
 */

import { offlineKnowledgeBase } from './offlineKnowledgeBase';

export interface ActiveShiftInfo {
  code: string;
  name: string;
  span: string;
  arrivalWindow: string;
  elapsedStr: string;
  remainingStr: string;
  progressPercent: number;
  upcomingShift: string;
  isNightShift: boolean;
}

export class LocalAssistantService {
  private static instance: LocalAssistantService;

  private constructor() {}

  public static getInstance(): LocalAssistantService {
    if (!LocalAssistantService.instance) {
      LocalAssistantService.instance = new LocalAssistantService();
    }
    return LocalAssistantService.instance;
  }

  /**
   * Detect if a user query is asking for time, date, day, or operational shift status
   */
  public isTimeOrShiftQuery(query: string): boolean {
    const q = query.trim().toLowerCase();
    
    // Slash commands
    if (/^\/(?:time|clock|date|shift|today)$/i.test(q)) return true;

    // Time queries
    if (/\b(?:what(?:'s|\s+is)?\s+(?:the\s+)?(?:current\s+)?time|what\s+time\s+is\s+it|time\s+now|current\s+time|tell\s+(?:me\s+)?(?:the\s+)?time)\b/i.test(q)) {
      return true;
    }

    // Date / day queries
    if (/\b(?:what(?:'s|\s+is)?\s+(?:the\s+)?(?:current\s+)?date|what\s+date\s+is\s+(?:it|today)|today(?:'s)?\s+date|what\s+day\s+is\s+(?:it|today))\b/i.test(q)) {
      return true;
    }

    // Shift queries
    if (/\b(?:what|which)\s+shift\s+(?:is\s+)?(?:running|active|now|currently\s+active|going\s+on)\b/i.test(q)) {
      return true;
    }

    if (/\b(?:current\s+shift|active\s+shift|shift\s+timings?|shift\s+hours?|who\s+is\s+on\s+shift)\b/i.test(q)) {
      return true;
    }

    return false;
  }

  /**
   * Compute currently active Paradigm Operational Shift based on system clock
   * strictly adhering to Paradigm Shift Engine Rules.
   */
  public getActiveShift(date: Date = new Date()): ActiveShiftInfo {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Shift Windows (Minutes from midnight):
    // Shift A: 07:00 (420) to 15:00 (900)
    // Shift B: 14:00 (840) to 22:00 (1320)
    // Shift C: 22:00 (1320) to 06:00 (360) next day
    // Note: 14:00 - 15:00 is overlap handover window between A and B
    
    let code = 'A';
    let name = 'Shift A (Morning Operational Shift)';
    let span = '07:00 – 15:00 (8 hrs)';
    let arrivalWindow = '05:00 – 11:30';
    let shiftStartMins = 420; // 07:00
    let shiftEndMins = 900;   // 15:00
    let upcomingShift = 'Shift B (Afternoon Shift: 14:00 – 22:00)';
    let isNightShift = false;

    if (totalMinutes >= 420 && totalMinutes < 840) {
      // 07:00 to 14:00: Pure Shift A
      code = 'A';
      name = 'Shift A (Morning Operational Shift)';
      span = '07:00 – 15:00 (8 hrs)';
      arrivalWindow = '05:00 – 11:30';
      shiftStartMins = 420;
      shiftEndMins = 900;
      upcomingShift = 'Shift B (Afternoon Shift: 14:00 – 22:00)';
    } else if (totalMinutes >= 840 && totalMinutes < 900) {
      // 14:00 to 15:00: Shift A / Shift B Handover Window
      code = 'A / B';
      name = 'Shift A & B Handover Window';
      span = '14:00 – 15:00 (Active Handover)';
      arrivalWindow = 'Shift B Arrival: 11:30 – 18:30';
      shiftStartMins = 840;
      shiftEndMins = 900;
      upcomingShift = 'Shift B (Full Takeover at 15:00)';
    } else if (totalMinutes >= 900 && totalMinutes < 1320) {
      // 15:00 to 22:00: Pure Shift B
      code = 'B';
      name = 'Shift B (Afternoon / Evening Shift)';
      span = '14:00 – 22:00 (8 hrs)';
      arrivalWindow = '11:30 – 18:30';
      shiftStartMins = 840;
      shiftEndMins = 1320;
      upcomingShift = 'Shift C (Night Shift: 22:00 – 06:00)';
    } else {
      // 22:00 to 07:00: Shift C (Night Shift - crosses midnight)
      code = 'C';
      name = 'Shift C (Night Operational Shift)';
      span = '22:00 – 06:00 / 07:00 (8-9 hrs)';
      arrivalWindow = '18:30 – 23:59 (Anchored to Day 1)';
      isNightShift = true;
      upcomingShift = 'Shift A (Morning Shift: 07:00 – 15:00)';

      if (totalMinutes >= 1320) {
        // Pre-midnight portion (22:00 to 23:59)
        shiftStartMins = 1320;
        shiftEndMins = 1440 + 360; // 06:00 next day
      } else {
        // Post-midnight portion (00:00 to 07:00)
        shiftStartMins = -120; // 22:00 previous day
        shiftEndMins = 360;    // 06:00
      }
    }

    // Elapsed & Remaining calculations
    let currentNorm = totalMinutes;
    if (isNightShift && totalMinutes >= 1320) {
      currentNorm = totalMinutes;
    } else if (isNightShift && totalMinutes < 420) {
      currentNorm = totalMinutes + 1440;
      shiftStartMins = 1320;
      shiftEndMins = 1440 + 360;
    }

    const totalDuration = Math.max(shiftEndMins - shiftStartMins, 60);
    const elapsedMinutes = Math.max(0, currentNorm - shiftStartMins);
    const remainingMinutes = Math.max(0, shiftEndMins - currentNorm);
    const progressPercent = Math.min(Math.round((elapsedMinutes / totalDuration) * 100), 100);

    const formatMins = (m: number) => {
      const hrs = Math.floor(m / 60);
      const rem = m % 60;
      if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m`;
      if (hrs > 0) return `${hrs}h`;
      return `${rem}m`;
    };

    return {
      code,
      name,
      span,
      arrivalWindow,
      elapsedStr: formatMins(elapsedMinutes),
      remainingStr: formatMins(remainingMinutes),
      progressPercent,
      upcomingShift,
      isNightShift
    };
  }

  /**
   * Build complete real-time clock and shift status response
   */
  public generateTimeAndShiftReport(siteName: string = 'Current Site'): string {
    const now = new Date();
    
    // Time format: e.g. 07:35:12 AM
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Date format: e.g. Friday, 9 October 2026
    const dateStr = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Timezone string
    const tzStr = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata (IST)';

    const shift = this.getActiveShift(now);

    return `🕒 **Current Local Time & Operational Schedule**\n\n` +
      `• **Time**: **${timeStr}**\n` +
      `• **Date**: **${dateStr}**\n` +
      `• **Time Zone**: ${tzStr}\n` +
      `• **Site Context**: ${siteName}\n\n` +
      `⚡ **Active Operational Shift:**\n` +
      `• **Current Shift**: 🟢 **${shift.name}**\n` +
      `• **Working Span**: \`${shift.span}\`\n` +
      `• **Shift Progress**: ${shift.progressPercent}% (\`${shift.elapsedStr} elapsed\`, \`${shift.remainingStr} remaining\`)\n` +
      `• **Punch-in Window**: \`${shift.arrivalWindow}\`\n` +
      `• **General Shift (GS)**: \`09:00 – 18:00\`\n` +
      `• **Next Handover**: \`${shift.upcomingShift}\`\n\n` +
      `💡 **Quick Operations Shortcuts:**\n` +
      `• Type \`/handover\` to format your end-of-shift briefing.\n` +
      `• Click **Duty Roster** in the top bar to inspect today's site staffing.\n` +
      `• Type *"remind me in 15 minutes to inspect DG readings"* to set an alarm.`;
  }

  /**
   * Detect and evaluate safe basic arithmetic calculations (e.g. "calculate 25 * 40")
   */
  public detectMathCalculation(query: string): { expression: string; result: number } | null {
    const q = query.trim();
    let rawExpr = '';

    // 1. Prefixed calculations (e.g. "calculate 25 * 40", "what is 1+1")
    const prefixMatch = q.match(/^(?:calculate|compute|what\s+is|\/calc)\s+([0-9\.\s\+\-\*\/\(\)\%]+)[=?\?]*$/i);
    if (prefixMatch) {
      rawExpr = prefixMatch[1].trim();
    } else {
      // 2. Direct arithmetic expressions (e.g. "1+1=", "4+2=", "2+2?", "100 * 5", "25 + 75")
      const directMatch = q.match(/^([0-9\.\s\+\-\*\/\(\)\%]+)[=?\?]*$/);
      if (directMatch) {
        const candidate = directMatch[1].trim();
        if (/[\+\-\*\/\%]/.test(candidate) && /\d+\s*[\+\-\*\/\%]\s*\d+/.test(candidate)) {
          rawExpr = candidate;
        }
      }
    }

    if (!rawExpr) return null;
    if (!/^[0-9\.\s\+\-\*\/\(\)\%]+$/.test(rawExpr)) return null;

    try {
      const sanitized = rawExpr.replace(/[^0-9\.\+\-\*\/\(\)\%]/g, '');
      if (!sanitized) return null;

      const result = new Function(`"use strict"; return (${sanitized});`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return {
          expression: rawExpr,
          result: Math.round(result * 10000) / 10000
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Generate instant on-device formatted answers for field operations with 0 network latency
   */
  public generateOfflineAnswer(query: string, siteName: string = 'All Paradigm Sites'): { text: string; sources: any[] } {
    const q = query.toLowerCase().trim();
    // 0A. Capabilities, Identity & Help ("what can you do?", "what are the things you can do?", "who are you?")
    if (/\b(what.*can\s+you\s+do|what\s+are\s+the\s+things\s+you\s+can\s+do|capabilities|features|who\s+are\s+you|what\s+is\s+your\s+role|help\s+me|how\s+to\s+use)\b/i.test(q)) {
      const text = `### 🤖 Paradigm Assist 4.0 — Operational Capabilities (Offline Field Mode)

Namaste! I am **Paradigm Assist**, your official enterprise digital operations copilot for **${siteName}**.

Operating 100% locally on your device without internet, I can assist you with:

---

#### 📝 1. HR & Corporate Letter Drafting
- **Leave Applications:** Draft professional 3-day emergency leaves, casual leaves, or sick leave applications with shift handover notes.
  - *Example:* *"Draft a formal leave application for 3 days due to personal emergency starting next Monday."*
- **Broadcast Notices:** Create WhatsApp announcements for residents (e.g. DG servicing, water tank cleaning).

#### 💧 2. Engineering & Process Flowcharts
- **WTP Flowsheet:** Generate ready-to-render 7-stage Water Treatment Plant horizontal Mermaid flowcharts (\`graph LR\`) with IS 10500 standards.
  - *Example:* *"wtp flow chart i need"*
- **STP Flowsheet:** Generate 8-stage Sewage Treatment Plant process diagrams with CPCB parameters (DO, MLSS, SV30).
  - *Example:* *"stp flow chart i need"*

#### ⚡ 3. MEP Equipment & Life-Safety SOPs
- **DG Cold Start:** Step-by-step generator pre-check, battery voltage, and ACB load transfer procedure.
- **Lift Passenger Rescue:** Elevator entrapment evacuation protocol with 2-technician manual brake release rules.
- **Fire & Gas Safety:** FACP loop verification, MCP activation, and gas manifold emergency isolation.

#### ⏱️ 4. Dynamic Shift Engine & Roster Intelligence
- **Real-time Clock:** Type *"time now"* or *"active shift"* to inspect the running shift, arrival windows, and progress.
- **Double Duty Policies:** Explain 14h continuous double duty criteria (A+B, B+C, A+C) and weekly off caps.
  - *Example:* *"What are the double duty rules?"*

#### 🧮 5. On-Device Technical Calculator
- Instantly solve unit calculations and arithmetic formulas without internet (e.g. \`calculate 25 * 40\`).

---
💡 *Tip: Feel free to ask any question above in English or Hinglish!*`;

      return {
        text,
        sources: [
          { id: 'paradigm-capabilities', title: 'Paradigm Assist Operational Capabilities', sourceTable: 'System Grounding' }
        ]
      };
    }

    // 0B. Polite Greetings ("hi", "hello", "namaste", "good morning")
    if (/^(hi|hello|hey|namaste|vanakkam|namaskara|good\s+(?:morning|afternoon|evening))\b/i.test(q) && q.split(/\s+/).length <= 4) {
      const shift = this.getActiveShift();
      const text = `### 👋 Namaste! Greetings from Paradigm Assist

Welcome to **Paradigm Assist 4.0**. I am ready to support your operations at **${siteName}**.

⚡ **Current Site Context:**
- **Active Operational Shift:** 🟢 **${shift.name}** (\`${shift.span}\`)
- **Shift Progress:** ${shift.progressPercent}% (\`${shift.remainingStr} remaining\`)

**How can I assist you right now?**
- 📝 Need a formal leave application or notice drafted?
- 💧 Need a WTP or STP horizontal process flow-chart?
- ⚡ Need DG startup or lift entrapment emergency SOPs?
- ⏱️ Need shift timings or double duty multiplier rules?`;

      return {
        text,
        sources: [{ id: 'greeting', title: 'Operational Welcome Context', sourceTable: 'System Grounding' }]
      };
    }

    // 0C. Shift Engine & Double Duty Questions
    if (/\b(double\s+duty|shift\s+rules|shift\s+timings?|shift\s+policy|a\+b|b\+c|a\+c|weekly\s+off\s+rules?|weekly\s+off\s+cap|night\s+shift\s+rule)\b/i.test(q)) {
      const text = `### ⏱️ Paradigm Dynamic Shift & Double Duty Policy (ISO 9001:2015)

According to official Paradigm Shift Engine standards:

#### 1. Standard Shift Arrival Windows:
- **Shift A (Morning):** Arrival \`05:00 – 11:30\` (Standard: \`07:00 – 15:00\`, Multiplier \`1.0x\`).
- **Shift B (Afternoon):** Arrival \`11:30 – 18:30\` (Standard: \`14:00 – 22:00\`, Multiplier \`1.0x\`).
- **Shift C (Night):** Arrival \`18:30 – 23:59\` (Standard: \`22:00 – 06:00/07:00\`, Multiplier \`1.0x\`).
  - *Midnight Rule:* Night shift is permanently anchored to **Day 1 (IN Date)**. Next morning exit belongs to Day 1.

#### 2. Double Duty Requirements (2.0x Multiplier):
An employee qualifies for **2.0x Double Duty credit** ONLY when completing two full operational shifts spanning $\\ge 14\\text{ hours}$ across standard windows:
- **Shift A + B:** Punch-in \`06:00 – 08:30\`, departure $\\ge 22:00$ ($\\ge 14\\text{h}$). Multiplier: **2.0x**.
- **Shift B + C:** Punch-in \`13:30 – 15:30\`, departure $\\ge 06:00\\text{ AM next day}$ ($\\ge 14\\text{h}$). Multiplier: **2.0x**.
- **Shift A + C:** Morning Shift A + separate night Shift C on the same calendar day. Multiplier: **2.0x**.

⚠️ **Important Distinction:** Working 10 to 12 hours is **1.0 Duty + Overtime Hours**, NOT Double Duty.

#### 3. Weekly Off (W/O) Rules:
- Earned after completing 6 active duties.
- **Strict Cap:** Maximum **1 Weekly Off per calendar week (Monday to Sunday)**. Any additional unworked days are marked Absent (A).`;

      return {
        text,
        sources: [{ id: 'sop-shift-engine', title: 'Paradigm Shift Engine & Multiplier Policy', sourceTable: 'Operations Policy' }]
      };
    }

    // 1. HR Leave Application & Corporate Letter Drafting (Fixes Image 1)
    if (/\b(leave\s+application|leave\s+letter|apply\s+for\s+leave|formal\s+leave|draft.*leave|request.*leave|sick\s+leave|casual\s+leave|emergency\s+leave|leave\s+for\s+\d+\s+days?)\b/i.test(q) ||
        (/\b(leave|chutti)\b/i.test(q) && /\b(draft|application|apply|request|formal|days?)\b/i.test(q))) {
      const daysMatch = q.match(/(\d+)\s*days?/i);
      const daysStr = daysMatch ? `${daysMatch[1]} days` : '3 days';
      const reasonStr = /emergency/i.test(q) ? 'personal family emergency' : /sick|ill|health/i.test(q) ? 'medical indisposition' : 'unavoidable personal matter';

      const text = `### 📝 Formal Leave Application (Corporate Standard)

**Subject:** Formal Leave Application – ${reasonStr.toUpperCase()} (${daysStr})

---

**To:**  
The Facility Manager / HR Operations  
Paradigm Integrated Facility Services Pvt. Ltd.  
**Site:** ${siteName}  

**Date:** ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  

**Dear Sir/Madam,**

I am writing to formally request **${daysStr}** of approved leave starting from **[Start Date, e.g. Monday]** to **[End Date]**, due to an urgent ${reasonStr} that requires my immediate presence.

I have briefed my colleague, **[Colleague Name / Shift Handover]**, regarding ongoing site checklists and operational routines to ensure that MEP and facility maintenance continue without interruption during my absence. I will also be reachable on phone at **[Your Mobile Number]** for urgent operational escalations.

Kindly sanction my leave application for the aforementioned period.

Thank you for your understanding and support.

**Warm regards,**  
**[Your Full Name]**  
**Designation:** [Technician / Supervisor / Executive]  
**Employee ID:** [Your ID]  
**Paradigm Integrated Facility Services**`;

      return {
        text,
        sources: [
          { id: 'hr-leave-sop', title: 'Paradigm HR Leave & Attendance Policy (ISO 9001:2015)', sourceTable: 'HR Operations Manual' }
        ]
      };
    }

    // 2. WTP (Water Treatment Plant) Flow-Chart & Operation (Fixes Image 2)
    if (/\b(wtp|water\s+treatment\s+plant|drinking\s+water\s+treatment|potable\s+water|clariflocculator)\b/i.test(q)) {
      const text = `### 📱 Paradigm Assist — Standard WTP Operational Flow-Chart (Field Mode)

Below is the verified process flow-chart for a Water Treatment Plant (WTP / Drinking Water Facility) operating under Paradigm ISO 9001:2015 guidelines:

\`\`\`mermaid
graph LR
    1["1. Raw Water Intake & Aeration"] --> 2["2. Coagulation & Flash Mixing (Alum Dosing)"]
    2 --> 3["3. Flocculation & Clariflocculator"]
    3 --> 4["4. Rapid Sand Gravity Filtration"]
    4 --> 5["5. Activated Carbon Adsorption"]
    5 --> 6["6. Post-Chlorination / UV Disinfection"]
    6 --> 7["7. Clear Water Reservoir (CWR) Distribution"]
\`\`\`

#### WTP Process Stages & Quality Standards:
- **1. Raw Water Aeration:** Removes dissolved iron, manganese, and volatile gases (H2S); improves taste and odor.
- **2. Coagulation & Flash Mixing:** Dosing of Alum / Poly-Aluminum Chloride (PAC) at high velocity (30-60 sec) to destabilize colloidal turbidity.
- **3. Clariflocculator:** Slow mechanical mixing promotes floc agglomeration. Settleable flocs sink to bottom sludge hopper.
- **4. Rapid Sand Filtration:** Graded gravel and fine silica sand filter out remaining microscopic flocs. Regular backwashing required when head loss > 1.5m.
- **5. Activated Carbon Filter:** Eliminates residual chlorine, pesticides, color, and organic compounds.
- **6. Disinfection:** Gas chlorination or Sodium Hypochlorite dosing ensuring **0.2 to 0.5 ppm residual chlorine** at farthest consumer tap.
- **7. Potable Water Quality (IS 10500 Standard):**
  - Turbidity: < 1.0 NTU
  - pH: 6.5 to 8.5
  - Total Dissolved Solids (TDS): < 500 mg/L
  - Coliform: 0 CFU / 100 mL`;

      return {
        text,
        sources: [
          { id: 'sop-wtp-operation', title: 'WTP Standard Operational & Testing Manual', sourceTable: 'Offline ISO 9001 Manual' },
          { id: 'is-10500-spec', title: 'IS 10500 Drinking Water Specifications', sourceTable: 'National Quality Standards' }
        ]
      };
    }

    // 3. STP / Wastewater / Sewage Flowchart & Operation
    if (/\b(stp|wastewater|sewage|treatment|aeration|clarifier|effluent|sludge)\b/i.test(q)) {
      const text = `### 📱 Paradigm Assist — Standard STP Operational Flow-Chart (Field Mode)

Below is the verified operational process flow-chart for a Sewage Treatment Plant (STP) operating under Paradigm ISO 9001:2015 operational guidelines:

\`\`\`mermaid
graph LR
    subgraph Liquid_Stream ["Main Liquid Treatment Stream (Inlet to Outlet)"]
        1["1. Raw Sewage Intake & Bar Screening"] --> 2["2. Grit & Grease Removal Chamber"]
        2 --> 3["3. Primary Sedimentation (Clarifier)"]
        3 --> 4["4. Biological Aeration Tank (MBBR/ASP)"]
        4 --> 5["5. Secondary Clarifier (SST)"]
        5 --> 6["6. Tertiary Dual Media Pressure Filter"]
        6 --> 7["7. Disinfection (Chlorine / UV Contact)"]
        7 --> 8["8. Treated Effluent Reuse Basin"]
    end

    subgraph Sludge_Stream ["Sludge Handling Line"]
        S1["Sludge Thickener"] --> S2["Sludge Digester / Stabilization"]
        S2 --> S3["Dewatering Press (Filter Press)"]
        S3 --> S4["Dried Biosolids Disposal"]
    end

    3 -.-> S1
    5 -.-> S1
\`\`\`

#### Operational Parameters & Quality Standards:
- **Bar Screening:** Keep clear of plastics, rags, and coarse solids to prevent intake pump failure.
- **Aeration Tank (MBBR / ASP):**
  - Dissolved Oxygen (DO): Maintain strictly between **2.0 to 4.0 mg/L**.
  - MLSS (Biomass): Maintain between **2500 to 3500 mg/L**.
  - SV30 Settling: Target 30-min settled volume is **200 to 350 mL/L**.
- **Secondary Clarifier:** Recirculate active biomass via Return Activated Sludge (RAS: 50–100%) and purge excess sludge to Thickener.
- **Tertiary Filtration:** Dual media sand filter + Activated Carbon filter (Turbidity target < 2 NTU).
- **Disinfection:** Maintain residual chlorine between **0.5 – 1.0 ppm**.
- **Treated Effluent:** Safe for toilet flushing, landscape irrigation, and HVAC cooling towers (BOD < 10 mg/L, COD < 50 mg/L, TSS < 10 mg/L).`;

      return {
        text,
        sources: [
          { id: 'sop-stp-aeration', title: 'STP Aeration & Operational Guidelines', sourceTable: 'Offline ISO 9001 Manual' },
          { id: 'wwtp-schematic', title: 'WWTP / STP 3-Stage Process Flowsheet', sourceTable: 'Paradigm Engineering Manual' }
        ]
      };
    }

    // 2. DG Cold Start SOP
    if (/\b(dg|generator|diesel generator|cold start|amf)\b/i.test(q)) {
      const text = `### 📱 Paradigm Assist — DG Cold Start Standard Operating Procedure (Field Mode)

\`\`\`mermaid
graph LR
    A["1. Battery & Fuel Check"] --> B["2. Lube Oil & Coolant Level"]
    B --> C["3. Switch AMF Controller"]
    C --> D["4. Key Crank (< 10 sec)"]
    D --> E["5. Verify Oil Pressure (3.5-5.0 kg/cm2)"]
    E --> F["6. Output Stable (415V, 50Hz)"]
    F --> G["7. Close ACB Breaker"]
\`\`\`

#### Step-by-Step Procedure:
1. **Pre-start Checks:** Battery terminal voltage $\\ge 24\\text{V DC}$, Diesel fuel level $\\ge 70\\%$, Lube oil between MIN and MAX.
2. **Coolant:** Inspect radiator expansion tank level. Never open radiator cap when hot!
3. **AMF Switch:** Switch controller to MANUAL for test run, or AUTO for standby.
4. **Crank:** Crank starter for maximum 10 seconds.
5. **Oil Pressure:** Verify oil pressure reaches **3.5 to 5.0 kg/cm²** within 15 seconds.
6. **Voltage Stability:** Confirm stable **415V AC (±2%)** and **50 Hz** frequency before taking load.`;

      return {
        text,
        sources: [{ id: 'sop-dg-cold-start', title: 'DG Cold Start SOP', sourceTable: 'Offline ISO 9001 Manual' }]
      };
    }

    // 3. Lift / Elevator Entrapment Protocol
    if (/\b(lift|elevator|entrapment|passenger trapped|stuck in lift)\b/i.test(q)) {
      const text = `### 📱 Paradigm Assist — Lift Passenger Entrapment Rescue Protocol (Field Mode)

\`\`\`mermaid
graph LR
    A["1. Reassure Stranded Passengers"] --> B["2. Switch OFF Machine Room Main Power (LOTO)"]
    B --> C["3. Verify Floor Rope Marking"]
    C --> D{"Within ±300mm Level?"}
    D -- Yes --> E["Open Doors with Landing Key"]
    D -- No --> F["2 Technicians Manual Brake Drift"]
    F --> E
    E --> G["Safe Passenger Exit & Lockout"]
\`\`\`

#### Emergency Safety Rules:
- **Talk via Intercom:** Reassure passengers they are safe and emergency ventilation is active.
- **Power Lockout:** Switch OFF 3-phase main breaker before touching motor/ropes.
- **Landing Key:** If within leveling zone (±300mm), open doors directly with emergency key.
- **Brake Release:** Requires 2 trained technicians. Never attempt manual brake release alone!`;

      return {
        text,
        sources: [{ id: 'sop-lift-entrapment', title: 'Passenger Lift Entrapment Rescue Protocol', sourceTable: 'Offline ISO 9001 Manual' }]
      };
    }

    // 4. Default: Query offline SOPs using token match
    const matchedSOPs = offlineKnowledgeBase.searchRelevantSOPs(query, 2);
    if (matchedSOPs && matchedSOPs.length > 0) {
      const sop = matchedSOPs[0];
      const safetyText = sop.safetyWarnings?.length
        ? `**Safety Warnings:**\n${sop.safetyWarnings.map(w => `⚠️ ${w}`).join('\n')}\n\n`
        : '';
      const stepsText = sop.steps.map((st, i) => `${i + 1}. ${st}`).join('\n');
      const contactsText = sop.contacts?.length
        ? `\n\n**Emergency Contacts:**\n${sop.contacts.map(c => `• **${c.role}**: 📞 ${c.phone}`).join('\n')}`
        : '';

      const text = `### 📱 Paradigm Assist — ${sop.title} (Field Mode)\n\n` +
        `**Summary:** ${sop.summary}\n\n` +
        safetyText +
        `**Operational Steps:**\n${stepsText}` +
        contactsText;

      return {
        text,
        sources: matchedSOPs.map(s => ({ id: s.id, title: s.title, sourceTable: 'Offline SOP Cache (ISO 9001)' }))
      };
    }

    // 5. General Operational Guidance Fallback
    return {
      text: `📱 **Paradigm Assist — Field Operational Guidance**\n\n` +
        `Your query has been processed in offline field mode for **${siteName}**.\n\n` +
        `For emergency assistance or equipment verification without internet, you can ask for:\n` +
        `• **"STP flow chart"** — Sewage Treatment Plant operational diagram and DO parameters\n` +
        `• **"DG cold start"** — Diesel Generator startup checklist and voltage checks\n` +
        `• **"Lift entrapment"** — Passenger extraction and brake release protocol\n` +
        `• **"Fire emergency"** — FACP response and evacuation plan\n` +
        `• **"Time now" / "Active shift"** — Real-time clock and active shift timings\n\n` +
        `*Tip: To query broad cloud knowledge, toggle the model selector to **Cloud AI (Groq Fast)** or **Auto Hybrid**.*`,
      sources: [{ id: 'general-ops', title: 'Offline Field Guidance', sourceTable: 'Local Knowledge Base' }]
    };
  }
}

export const localAssistantService = LocalAssistantService.getInstance();
