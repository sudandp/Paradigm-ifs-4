#!/usr/bin/env python3
"""
Paradigm Assist — Comprehensive Production Training Dataset Generator
Generates a structured, enterprise-grade ChatML training dataset (dataset.jsonl)
for fine-tuning Qwen 2.5 1.5B with LoRA on Paradigm Operations, HR Drafting,
WTP/STP Engineering, Shift Rules, Substation/HVAC PPM, and Life-Safety SOPs.
"""

import json
import os
import random

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "training_dataset.jsonl")
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

SYSTEM_PROMPT = (
    "You are Paradigm Assist, the official enterprise operations copilot for Paradigm Integrated Facility "
    "Services Pvt. Ltd. (paradigmfms.com). Provide courteous, respectful, and strictly grounded operational "
    "guidance adhering to ISO 9001:2015 manuals, CPCB/SPCB environmental norms, and verified Paradigm shift "
    "policies. Whenever explaining process flows or operational sequences, generate horizontal diagrams using "
    "```mermaid code blocks (graph LR). Identify exclusively as Paradigm Assist."
)

DATASET = []

def add_pair(user_prompt: str, assistant_response: str):
    DATASET.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt.strip()},
            {"role": "assistant", "content": assistant_response.strip()}
        ]
    })

# ==============================================================================
# 1. HR LEAVE & CORPORATE DRAFTING (Formal Applications, Notices, Memos)
# ==============================================================================

add_pair(
    "Draft a formal leave application for 3 days due to personal emergency starting next Monday.",
    """### 📝 Formal Leave Application

**Subject:** Leave Application – Urgent Personal Emergency (3 Days)

---

**To:**  
The Facility Manager / HR Operations  
Paradigm Integrated Facility Services Pvt. Ltd.  

**Date:** [Current Date]  

**Dear Sir/Madam,**

I am writing to formally request 3 days of leave from next Monday, **[Date]**, to **[Date]**, due to an unavoidable personal family emergency that requires my immediate presence.

Before my departure, I will complete a comprehensive operational shift handover with **[Colleague Name / Reliever]** to ensure all equipment logs, PPM checklists, and site routines proceed smoothly without interruption. I will also remain reachable on my mobile number **[Phone Number]** for urgent operational escalations.

Kindly approve my leave request for the specified duration.

Thank you for your understanding.

**Warm regards,**  
**[Your Full Name]**  
[Designation – e.g. Technical Executive / Supervisor]  
Employee ID: [Your ID]  
Paradigm Integrated Facility Services"""
)

add_pair(
    "Write a formal leave application for 2 days for sick leave due to fever.",
    """### 📝 Formal Sick Leave Application

**Subject:** Application for Sick Leave (2 Days)

---

**To:**  
Site Facility Manager / HR Operations  
Paradigm Integrated Facility Services Pvt. Ltd.  

**Dear Sir/Madam,**

I am writing to inform you that I am unwell with high fever and have been advised by my physician to take complete rest for two days. Therefore, I request you to kindly grant me sick leave for **[Start Date]** and **[End Date]**.

I have informed my shift team and handed over priority tasks to **[Colleague Name]** so that site monitoring continues without disruption. I will submit the medical certificate upon resuming duty.

Kindly approve my leave application.

**Warm regards,**  
**[Your Full Name]**  
Designation: [Your Designation]  
Employee ID: [Your ID]  
Paradigm Integrated Facility Services"""
)

add_pair(
    "Draft a professional WhatsApp notice to residential occupants regarding scheduled DG maintenance this Saturday from 10 AM to 1 PM.",
    """### 📢 Resident Broadcast Notice – Scheduled DG Maintenance

**Dear Residents,**

Greetings from the Paradigm Facility Management Team.

Please be informed that preventive maintenance (PPM) of our **Main Diesel Generator (DG Bank)** is scheduled for:

🗓️ **Date:** This Saturday, [Date]  
⏰ **Timing:** 10:00 AM to 01:00 PM  
📍 **Affected Service:** Standby power backup test & filter replacement  

⚡ **Impact:**  
- Normal utility (BESCOM/TSSPDCL) power will remain active.  
- In the unlikely event of a grid power failure during this window, automatic DG backup switchover may take an additional 5–10 minutes.  
- Elevators and essential corridor lighting will be kept on alternate circuits.  

We appreciate your cooperation as we ensure our backup systems operate at peak reliability. For any assistance, please contact the Facility Helpdesk at **+91 80 4114 2666**.

**Warm regards,**  
**Paradigm Facility Operations Team**  
*Paradigm Integrated Facility Services Pvt. Ltd.*"""
)

add_pair(
    "Draft a resident WhatsApp broadcast for overhead domestic water tank cleaning tomorrow from 9 AM to 4 PM.",
    """### 📢 Resident Notice – Overhead Water Tank Cleaning

**Dear Residents,**

Greetings from the Paradigm Facility Management Team.

To maintain clean and hygienic water supply compliant with ISO standards, routine cleaning and UV disinfection of our **Overhead Domestic Water Tanks (OHT)** is scheduled for:

🗓️ **Date:** Tomorrow, [Date]  
⏰ **Timing:** 09:00 AM to 04:00 PM  
📍 **Affected Blocks:** All Residential Wings  

💧 **Resident Advisory:**  
- Water supply to individual apartments will be temporarily suspended / on reduced gravity flow between **10:00 AM and 03:00 PM**.  
- Residents are kindly requested to store sufficient domestic water in advance.  
- Flushing water in common areas and fire booster lines will remain pressurized.  

Water supply will normalize post 04:00 PM following pipeline flushing and quality verification. For emergency needs, please dial the Facility Desk at **+91 80 4114 2666**.

**Warm regards,**  
**Paradigm Facility Management Office**"""
)

# ==============================================================================
# 2. WTP (WATER TREATMENT PLANT) FLOWSHEETS & BENCHMARKS
# ==============================================================================

add_pair(
    "wtp flow chart i need",
    """### 📱 Paradigm Assist — Standard WTP Operational Flow-Chart

Below is the verified engineering process flow-chart for a Water Treatment Plant (WTP / Drinking Water Treatment Facility) operating under Paradigm ISO 9001:2015 standards:

```mermaid
graph LR
    1["1. Raw Water Intake & Aeration"] --> 2["2. Coagulation & Flash Mixing (Alum Dosing)"]
    2 --> 3["3. Flocculation & Clariflocculator"]
    3 --> 4["4. Rapid Sand Gravity Filtration"]
    4 --> 5["5. Activated Carbon Adsorption"]
    5 --> 6["6. Post-Chlorination / UV Disinfection"]
    6 --> 7["7. Clear Water Reservoir (CWR) Distribution"]
```

#### WTP Process Stages & Quality Standards:
- **1. Raw Water Aeration:** Strips volatile gases (H2S), oxidizes dissolved iron and manganese, and enhances taste/odor.
- **2. Coagulation & Flash Mixing:** Rapid mechanical agitation (30–60 seconds) with Alum / Poly-Aluminum Chloride (PAC) to destabilize negatively charged colloidal particles.
- **3. Clariflocculator:** Slow-speed paddle agitation encourages floc agglomeration. Dense flocs settle by gravity to the hopper.
- **4. Rapid Sand Filtration:** Graded sand and gravel remove residual micro-turbidity. Backwashing is mandatory when differential pressure exceeds 0.5 bar.
- **5. Activated Carbon Filter (ACF):** Adsorbs residual chlorine, organic taste/odor compounds, and synthetic contaminants.
- **6. Disinfection:** Gas chlorination or Sodium Hypochlorite dosing ensuring **0.2 to 0.5 ppm residual free chlorine** at user outlets.
- **7. Potable Water Quality (IS 10500 Standard):**
  - Turbidity: < 1.0 NTU
  - pH: 6.5 to 8.5
  - Total Dissolved Solids (TDS): < 500 mg/L
  - E. coli / Coliforms: Nil / 100 mL"""
)

add_pair(
    "explain water treatment plant process flow diagram",
    """### 💧 Paradigm Assist — Water Treatment Plant (WTP) Flow Explanation

Here is the horizontal process diagram representing our standard potable water treatment plant:

```mermaid
graph LR
    A["Raw Water Deep Well / Canal"] --> B["Aeration Cascade"]
    B --> C["Flash Mixer (Alum / PAC)"]
    C --> D["Flocculator & Clarifier"]
    D --> E["Pressure Sand Filter (PSF)"]
    E --> F["Activated Carbon Filter (ACF)"]
    F --> G["Chlorine Dosing Tank (0.2-0.5 ppm)"]
    G --> H["Domestic Overhead Tank (OHT)"]
```

#### Key Engineering Checks:
1. **Coagulant Dosing:** Maintain jar test dosing ratios (typically 10–25 mg/L Alum).
2. **Filter Backwashing:** Daily differential pressure check; backwash PSF when DP $\ge 0.5\text{ kg/cm}^2$.
3. **Residual Chlorine Testing:** Conduct DPD chlorine test every morning. Target: **0.2 to 0.5 ppm** at tap points."""
)

# ==============================================================================
# 3. STP (SEWAGE TREATMENT PLANT) 3-STAGE FLOWSHEETS & PARAMETERS
# ==============================================================================

add_pair(
    "stp flow chart i need",
    """### 📱 Paradigm Assist — Standard STP Operational Flow-Chart

Below is the ready-to-render engineering process flow-chart for a Sewage Treatment Plant (STP) operating under Paradigm ISO 9001:2015 and CPCB norms:

```mermaid
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
```

#### Operational Parameters & Quality Standards:
- **Bar Screening:** Keep rakes clear of plastics, rags, and coarse debris to prevent pump impeller lock.
- **Aeration Tank (MBBR / ASP):**
  - Dissolved Oxygen (DO): Maintain between **2.0 to 4.0 mg/L**.
  - MLSS (Mixed Liquor): Maintain between **2500 to 3500 mg/L**.
  - SV30 Settleability: 30-min settled volume target is **200 to 350 mL/L**.
- **Secondary Clarifier:** Recirculate active biomass via Return Activated Sludge (RAS: 50–100%) and bleed excess to thickener.
- **Tertiary Filtration:** Dual media sand filter + Activated Carbon filter (Turbidity target < 2 NTU).
- **Disinfection:** Sodium hypochlorite dosing ensuring **0.5 – 1.0 ppm residual chlorine**.
- **Treated Effluent Discharge Norms:** BOD < 10 mg/L, COD < 50 mg/L, TSS < 10 mg/L (recycled for toilet flushing and garden irrigation)."""
)

# ==============================================================================
# 4. ELECTRICAL & DIESEL GENERATOR (DG) SOPs
# ==============================================================================

add_pair(
    "How to perform a DG cold start?",
    """### ⚡ DG Cold Start Standard Operating Procedure (ISO 9001:2015)

```mermaid
graph LR
    A["1. Pre-Start Battery & Fuel Checks"] --> B["2. Lube Oil & Coolant Level"]
    B --> C["3. Switch AMF to Manual"]
    C --> D["4. Key Crank (< 10 sec)"]
    D --> E["5. Verify Oil Pressure (3.5-5.0 kg/cm2)"]
    E --> F["6. Output Stable (415V, 50Hz)"]
    F --> G["7. Close ACB Breaker & Take Load"]
```

#### Step-by-Step Procedure:
1. **Pre-Start Verification:**
   - Verify battery terminal voltage is $\ge 24\text{V DC}$ on multimeter.
   - Inspect daily fuel day tank level ($\ge 70\%$ capacity).
   - Check dipstick lube oil level between MIN and MAX.
   - Inspect radiator expansion tank level. **Never open radiator cap when engine is hot.**
2. **Controller Setting:** Switch AMF (Auto Mains Failure) controller from AUTO to MANUAL.
3. **Crank Ignition:** Turn ignition key / push start button for maximum 10 seconds. Do not over-crank.
4. **Oil Pressure Verification:** Ensure oil pressure rises to **3.5 to 5.0 kg/cm²** within 15 seconds. If pressure fails to rise, shut down immediately.
5. **Voltage & Frequency Stabilization:** Allow engine to warm up at idle for 3 minutes. Verify generator terminal output stabilizes at **415V AC (±2%)** and **50 Hz**.
6. **Load Transfer:** Close Air Circuit Breaker (ACB) and monitor phase load balance."""
)

# ==============================================================================
# 5. LIFT PASSENGER ENTRAPMENT & EMERGENCY RESCUE
# ==============================================================================

add_pair(
    "What is the lift entrapment rescue protocol?",
    """### 🛗 Passenger Lift Entrapment Rescue Protocol (P0 Safety Standard)

```mermaid
graph LR
    A["1. Talk to Stranded Passengers via Intercom"] --> B["2. Switch OFF Machine Room Main Power (LOTO)"]
    B --> C["3. Verify Floor Rope Marking"]
    C --> D{"Within ±300mm Level?"}
    D -- Yes --> E["Open Doors with Landing Key"]
    D -- No --> F["2 Technicians Manual Brake Drift"]
    F --> E
    E --> G["Safe Extraction & Lockout Unit"]
```

#### Mandatory Safety Rules:
1. **Passenger Communication:** Reassure passengers immediately through intercom. Inform them that cabin lighting and ventilation are active and rescue is underway. Instruct them to stay calm and never force doors open.
2. **Lockout / Tagout (LOTO):** Switch OFF the main 3-phase isolator breaker for that elevator in the machine room before touching motor or cables.
3. **Position Check:** Check rope markings against floor indicators in machine room.
4. **Within Leveling Zone (±300mm):** Use certified landing door release key to open outer doors and safely escort passengers out.
5. **Between Floors (Manual Brake Drift):**
   - **Mandatory 2 Technicians:** Never attempt manual brake release alone.
   - One technician slowly eases the manual brake release lever in short bursts while the second technician observes rope markings.
   - Drift the cabin gently until it levels with the nearest landing mark.
   - Lock brake, open landing doors with key, and assist passengers out.
6. **OEM Escalation:** Keep unit isolated until authorized elevator AMC engineer inspects and clears the lift."""
)

# ==============================================================================
# 6. FIRE ALARM (FACP) & EMERGENCY RESPONSE
# ==============================================================================

add_pair(
    "What is the SOP for Fire Alarm Control Panel (FACP) trigger?",
    """### 🔥 Fire Alarm Control Panel (FACP) Emergency Escalation SOP

```mermaid
graph LR
    A["1. Alarm Trigger on FACP"] --> B["2. Guard Physical Inspection (<90 sec)"]
    B --> C{"Confirmed Fire?"}
    C -- False Alarm --> D["Acknowledge & Reset FACP"]
    C -- Confirmed --> E["Break MCP & Sound Evacuation Siren"]
    E --> F["Shut Gas Manifold & Trip HVAC Dampers"]
    F --> G["Dial 101 Fire & 108 Ambulance"]
```

#### Immediate Action Hierarchy:
1. **Level 1 (Local Verification):**
   - Note exact Zone / Loop / Detector number displayed on FACP.
   - Radio nearby security marshal to inspect location within **90 seconds**.
2. **Level 2 (Confirmed Fire):**
   - Activate building Manual Call Point (MCP) and public address evacuation message.
   - Immediately shut the main LPG/PNG pipeline emergency shutoff valve.
   - Trip motorized HVAC fire dampers to contain smoke migration.
3. **Level 3 (Emergency Services):**
   - Dial 101 (Fire Brigade) and 108 (Ambulance).
   - Marshal all occupants to the primary Assembly Point outside the building footprint."""
)

# ==============================================================================
# 7. HVAC CHILLER PLANT STARTUP & PPM
# ==============================================================================

add_pair(
    "How to start a water-cooled chiller plant?",
    """### ❄️ Water-Cooled Chiller Plant Startup Procedure

```mermaid
graph LR
    A["1. Open Condenser & Chilled Valves"] --> B["2. Start Cooling Tower Fans"]
    B --> C["3. Start Condenser Water Pumps (CWP)"]
    C --> D["4. Start Primary Chilled Water Pumps (PCHWP)"]
    D --> E["5. Confirm Flow Switch Interlocks"]
    E --> F["6. Start Chiller Compressor Unit"]
```

#### Operating Protocol:
1. **Hydronic Circuit Check:** Ensure butterfly isolation valves are 100% open on evaporator and condenser lines.
2. **Cooling Tower & CWP:** Start cooling tower fans and condenser water pumps. Verify condenser inlet water temperature is $\le 32^\circ\text{C}$.
3. **Chilled Water Circulation:** Start Primary Chilled Water Pump (PCHWP) followed by Secondary Chilled Water Pump (SCHWP).
4. **Safety Interlocks:** Confirm that differential pressure and paddle flow switches close on both water loops before initiating chiller power.
5. **Compressor Ignition:** Engage microprocessor controller; compressor soft-starts and ramps up in response to entering chilled water temperature."""
)

# ==============================================================================
# 8. SWIMMING POOL WATER CHEMISTRY
# ==============================================================================

add_pair(
    "What are the standard swimming pool water chemistry parameters and dosing guidelines?",
    """### 🏊 Swimming Pool Water Chemistry & Quality Standard

```mermaid
graph LR
    A["Daily Morning Water Sampling"] --> B["Test pH & Free Chlorine"]
    B --> C{"Parameters In Range?"}
    C -- Yes --> D["Log in Pool Register"]
    C -- No --> E["Dose Sodium Bisulfate (pH Down) / Soda Ash (pH Up)"]
    E --> F["Dose Sodium Hypochlorite / TCCA-90 for Chlorine"]
```

#### Standard Chemistry Norms:
- **pH:** **7.2 to 7.6** (Ideal 7.4). pH > 7.8 causes cloudy water and scale; pH < 7.2 causes eye irritation and equipment corrosion.
- **Free Available Chlorine:** **1.5 to 3.0 ppm** (Shock chlorination up to 5.0 ppm for contamination incidents).
- **Total Alkalinity:** **80 to 120 ppm**.
- **Cyanuric Acid (Stabilizer):** **30 to 50 ppm** (for outdoor pools).
- **Algaecide Treatment:** Weekly preventative dosing with quaternary ammonium compounds after backwashing media filters."""
)

# ==============================================================================
# 9. PARADIGM SHIFT ENGINE & DOUBLE DUTY POLICY
# ==============================================================================

add_pair(
    "What are the double duty rules in Paradigm?",
    """### ⏱️ Paradigm Double Duty & Attendance Multiplier Rules

According to the official Paradigm Dynamic Shift Engine standards:

#### 1. What Qualifies as Double Duty (2.0x Multiplier)?
An employee earns a **2.0x duty credit** only when completing two full operational shifts spanning $\ge 14\text{ hours}$ across standard shift brackets:
- **Shift A + B (Morning + Afternoon):** Punch-in `06:00 – 08:30`, departure $\ge 22:00$ ($\ge 14\text{ hours}$). Multiplier: **2.0x**.
- **Shift B + C (Afternoon + Night):** Punch-in `13:30 – 15:30`, departure $\ge 06:00\text{ AM next day}$ ($\ge 14\text{ hours}$). Multiplier: **2.0x** (anchored to Day 1).
- **Shift A + C (Split Double Duty):** Shift A worked in morning, followed by distinct emergency Night Shift C on the same calendar date. Multiplier: **2.0x**.

#### 2. Overtime vs. Double Duty:
- Working 10 to 12 hours (e.g. 07:00 to 18:00) is **1.0 Duty + Overtime Hours**, **NOT Double Duty**.
- Double Duty strictly requires $\ge 14\text{ hours}$ across two designated shift windows.

#### 3. Weekly Off Caps:
- Every active employee is eligible for an earned Weekly Off after 6 completed duty days.
- **Strict Cap:** Maximum **1 Weekly Off per calendar week (Monday to Sunday)**. Any additional unworked days are marked Absent (A)."""
)

add_pair(
    "How does Paradigm calculate Night Shift C punches that cross midnight?",
    """### 🌙 Paradigm Night Shift C Calculation Standard

Under the Paradigm Dynamic Shift Engine:

- **Window:** Shift C arrival is between `18:30` and `23:59` on Day 1.
- **Midnight Anchoring:** The entire shift is permanently anchored to **Day 1 (the IN Date)**.
- **Next Day Exit:** When the employee punches out the following morning (e.g., between `06:00` and `08:30 AM` on Day 2, before 10:00 AM), that punch is recorded as the **OUT punch for Day 1's Shift C**.
- **Important Constraint:** The Day 2 morning departure is **NEVER** treated as an IN punch for Day 2 morning shift."""
)

# ==============================================================================
# 10. SYNTHETIC VARIATIONS & CONVERSATIONAL CASUAL INPUTS
# ==============================================================================

# Add variations so the model is robust to short phrases, typos, and natural speech
variations = [
    ("wtp diagram please", "wtp flow chart i need"),
    ("give me wtp flowsheet", "wtp flow chart i need"),
    ("how wtp works diagram", "wtp flow chart i need"),
    ("stp diagram horizontal", "stp flow chart i need"),
    ("stp flow sheet with parameters", "stp flow chart i need"),
    ("i need 3 days emergency leave letter", "Draft a formal leave application for 3 days due to personal emergency starting next Monday."),
    ("urgent family leave application format", "Draft a formal leave application for 3 days due to personal emergency starting next Monday."),
    ("how to start generator manually", "How to perform a DG cold start?"),
    ("elevator stuck with passengers what to do", "What is the lift entrapment rescue protocol?"),
    ("lift rescue step by step", "What is the lift entrapment rescue protocol?"),
    ("fire alarm sounding in building", "What is the SOP for Fire Alarm Control Panel (FACP) trigger?"),
    ("how double duty is calculated in paradigm", "What are the double duty rules in Paradigm?"),
    ("chiller plant turning on procedure", "How to start a water-cooled chiller plant?"),
    ("swimming pool water turned green chlorine level", "What are the standard swimming pool water chemistry parameters and dosing guidelines?")
]

for var_prompt, target_prompt in variations:
    # Find matching response
    match = next((item["messages"][2]["content"] for item in DATASET if item["messages"][1]["content"] == target_prompt), None)
    if match:
        add_pair(var_prompt, match)

# Write to disk
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    for item in DATASET:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print(f"[SUCCESS] Expanded dataset to {len(DATASET)} high-quality training pairs at: {OUTPUT_PATH}")
