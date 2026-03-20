-- Migration: Create Field Reporting System tables
-- Date: 2026-01-07

-- 1. Create Checklist Templates Table
CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL, -- e.g. 'PM', 'Breakdown'
    asset_category TEXT,   -- Optional: filter by asset type
    version INTEGER DEFAULT 1,
    sections JSONB NOT NULL, -- The structure of the checklist
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Field Reports Table
CREATE TABLE IF NOT EXISTS public.field_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    attendance_event_id UUID REFERENCES public.attendance_events(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.checklist_templates(id),
    user_id UUID REFERENCES auth.users(id),
    
    -- Context data (snapshot at time of submission)
    site_name TEXT,
    job_type TEXT,
    asset_area TEXT,
    visit_start_time TIMESTAMP WITH TIME ZONE,
    visit_end_time TIMESTAMP WITH TIME ZONE,
    
    -- Report Content
    responses JSONB NOT NULL, -- Structure: { item_id: { value: string|number, remarks: string, reason_id: string, photo_urls: string[] } }
    evidence JSONB DEFAULT '[]'::jsonb, -- Array of { url, type, timestamp, lat, lng, category }
    summary TEXT,
    user_remarks TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Add column to attendance_events for reciprocal linking
ALTER TABLE public.attendance_events ADD COLUMN IF NOT EXISTS field_report_id UUID REFERENCES public.field_reports(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for checklist_templates
CREATE POLICY "Allow authenticated users to read active templates"
ON public.checklist_templates FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Allow admins to manage templates"
ON public.checklist_templates FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role_id IN ('admin', 'super_admin')
));

-- 5. RLS Policies for field_reports
CREATE POLICY "Users can insert their own reports"
ON public.field_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can see their own reports"
ON public.field_reports FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()
    AND public.users.role_id IN ('admin', 'super_admin', 'manager')
));

-- 6. Insert Sample Templates for All Job Types
INSERT INTO public.checklist_templates (job_type, sections)
VALUES (
    'PPM',
    '[
        {
            "id": "ppm_execution",
            "title": "PPM Execution",
            "icon": "Tool",
            "items": [
                {"id": "cleaning", "label": "Asset cleaning completed?", "type": "yes_no_na", "required": true},
                {"id": "lubrication", "label": "Lubrication/Greasing checked?", "type": "yes_no_na", "required": true},
                {"id": "filter_check", "label": "Filters cleaned/replaced?", "type": "yes_no_na", "required": false}
            ]
        },
        {
            "id": "measurements",
            "title": "Technical Measurements",
            "icon": "Activity",
            "items": [
                {"id": "voltage", "label": "Line Voltage (V)", "type": "numeric", "required": true},
                {"id": "current", "label": "Operating Current (A)", "type": "numeric", "required": true}
            ]
        }
    ]'::jsonb
),
(
    'Breakdown/Repair',
    '[
        {
            "id": "diagnosis",
            "title": "Diagnosis",
            "icon": "Search",
            "items": [
                {"id": "fault_code", "label": "Fault code identified?", "type": "yes_no_na", "required": true},
                {"id": "root_cause", "label": "Root cause found?", "type": "yes_no_na", "required": true}
            ]
        },
        {
            "id": "repair",
            "title": "Repair Status",
            "icon": "CheckCircle",
            "items": [
                {"id": "parts_used", "label": "Spare parts consumed?", "type": "yes_no_na", "required": true},
                {"id": "running_status", "label": "Is the system running now?", "type": "yes_no_na", "required": true}
            ]
        }
    ]'::jsonb
),
(
    'Site Training',
    '[
        {
            "id": "training_details",
            "title": "Training Details",
            "icon": "Users",
            "items": [
                {"id": "attendance", "label": "Are all trainees present?", "type": "yes_no_na", "required": true},
                {"id": "materials", "label": "Training materials distributed?", "type": "yes_no_na", "required": true}
            ]
        },
        {
            "id": "verification",
            "title": "Skill Verification",
            "icon": "Award",
            "items": [
                {"id": "hands_on", "label": "Hands-on demonstration successful?", "type": "yes_no_na", "required": true}
            ]
        }
    ]'::jsonb
),
(
    'Site Visit',
    '[
        {
            "id": "visit_purpose",
            "title": "Visit Purpose",
            "icon": "MapPin",
            "items": [
                {"id": "client_met", "label": "Met with client representative?", "type": "yes_no_na", "required": true},
                {"id": "satisfaction", "label": "Is client satisfied with services?", "type": "yes_no_na", "required": true}
            ]
        }
    ]'::jsonb
),
(
    'Meeting with Association',
    '[
        {
            "id": "meeting_summary",
            "title": "Meeting Summary",
            "icon": "MessagesSquare",
            "items": [
                {"id": "minutes", "label": "Minutes of meeting shared?", "type": "yes_no_na", "required": true},
                {"id": "escalations", "label": "Any major escalations raised?", "type": "yes_no_na", "required": true}
            ]
        }
    ]'::jsonb
),
(
    'Site Inspection',
    '[
        {
            "id": "audit_safety",
            "title": "Safety Audit",
            "icon": "ShieldCheck",
            "items": [
                {"id": "hazard_id", "label": "Any safety hazards identified?", "type": "yes_no_na", "required": true},
                {"id": "fire_safety", "label": "Fire safety protocols in place?", "type": "yes_no_na", "required": true}
            ]
        },
        {
            "id": "quality",
            "title": "Quality Inspection",
            "icon": "ClipboardCheck",
            "items": [
                {"id": "standards", "label": "Operating as per standards?", "type": "yes_no_na", "required": true}
            ]
        }
    ]'::jsonb
);
