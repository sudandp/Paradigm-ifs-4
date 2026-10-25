-- ================================================================
-- Paradigm Assist — Training & Feedback Schema
-- Phase 4: Training Examples Table
-- Phase 5: Feedback Learning Loop Table
-- ================================================================

-- ── Table 1: Training Examples (Phase 4) ─────────────────────────────────────
-- Stores curated question → intent mappings that improve classifier accuracy.
CREATE TABLE IF NOT EXISTS assist_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,                    -- Raw user question / utterance
  intent TEXT NOT NULL,                   -- Correct intent label (from IntentType)
  entities JSONB DEFAULT '{}',            -- Correct entity extraction (person, dateScope, site, etc.)
  expected_response TEXT,                 -- Gold-standard reply for evaluation
  category TEXT,                          -- 'attendance' | 'sop' | 'ticket' | 'leave' | 'onboarding' | 'general'
  is_active BOOLEAN DEFAULT true,         -- Soft-delete / disable without removing
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for category-based filtering in Training Studio
CREATE INDEX IF NOT EXISTS idx_training_examples_category ON assist_training_examples(category);
CREATE INDEX IF NOT EXISTS idx_training_examples_intent ON assist_training_examples(intent);

-- ── Table 2: Feedback Learning Log (Phase 5) ──────────────────────────────────
-- Every thumbs-up / thumbs-down is stored with intent + query for analysis.
CREATE TABLE IF NOT EXISTS assist_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,                        -- AssistMessage.id
  query TEXT NOT NULL,                    -- Raw user query that received this rating
  parsed_intent TEXT,                     -- What the classifier decided
  intent_confidence FLOAT,               -- Confidence score from classifier
  data_source TEXT,                       -- Which source was queried
  rating INT NOT NULL,                    -- 1 = thumbs up, -1 = thumbs down
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT,                         -- Logged for role-segmented analysis
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for weekly failure analysis
CREATE INDEX IF NOT EXISTS idx_feedback_intent ON assist_feedback_log(parsed_intent);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON assist_feedback_log(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON assist_feedback_log(created_at);

-- ── Seed Data: Phase 4 Training Examples ─────────────────────────────────────
-- Minimum 50 seed examples across all intent types.
-- Expand this list to 200+ over Weeks 4–5.

INSERT INTO assist_training_examples (query, intent, entities, category) VALUES

-- ── ATTENDANCE: INDIVIDUAL ───────────────────────────────────────────────────
('did kavya come today?', 'attendance_individual', '{"person":"kavya","dateScope":"today"}', 'attendance'),
('did kavya m come today?', 'attendance_individual', '{"person":"kavya m","dateScope":"today"}', 'attendance'),
('yesterday kavya m came to office?', 'attendance_individual', '{"person":"kavya m","dateScope":"yesterday"}', 'attendance'),
('is chennamma present today?', 'attendance_individual', '{"person":"chennamma","dateScope":"today"}', 'attendance'),
('chenamma came yesterday?', 'attendance_individual', '{"person":"chenamma","dateScope":"yesterday"}', 'attendance'),
('did raju report to work today?', 'attendance_individual', '{"person":"raju","dateScope":"today"}', 'attendance'),
('has meena checked in today?', 'attendance_individual', '{"person":"meena","dateScope":"today"}', 'attendance'),
('day before yesterday?', 'attendance_individual', '{"dateScope":"day_before_yesterday"}', 'attendance'),
('what about today?', 'attendance_individual', '{"dateScope":"today"}', 'attendance'),
('and yesterday?', 'attendance_individual', '{"dateScope":"yesterday"}', 'attendance'),
('did she punch out?', 'attendance_individual', '{"metric":"verify","dateScope":"today"}', 'attendance'),
('is mr sharma working today?', 'attendance_individual', '{"person":"sharma","dateScope":"today"}', 'attendance'),
('was kavya here on friday?', 'attendance_individual', '{"person":"kavya","dateScope":"last_friday"}', 'attendance'),
('did suresh arrive today?', 'attendance_individual', '{"person":"suresh","dateScope":"today"}', 'attendance'),

-- ── ATTENDANCE: SELF ─────────────────────────────────────────────────────────
('my attendance today', 'attendance_my_own', '{"dateScope":"today"}', 'attendance'),
('when did i punch in?', 'attendance_my_own', '{"dateScope":"today"}', 'attendance'),
('my punch status', 'attendance_my_own', '{"dateScope":"today"}', 'attendance'),
('did i clock in today?', 'attendance_my_own', '{"dateScope":"today"}', 'attendance'),
('what is my attendance yesterday?', 'attendance_my_own', '{"dateScope":"yesterday"}', 'attendance'),

-- ── HEADCOUNT: BACK-OFFICE ───────────────────────────────────────────────────
('how many back office staff present today?', 'headcount_backoffice', '{"dateScope":"today","staffCategory":"back_office"}', 'attendance'),
('back office attendance today', 'headcount_backoffice', '{"dateScope":"today"}', 'attendance'),
('office staff count today', 'headcount_backoffice', '{"dateScope":"today"}', 'attendance'),
('how many admin staff are in today?', 'headcount_backoffice', '{"dateScope":"today"}', 'attendance'),
('back office absent count', 'headcount_backoffice', '{"dateScope":"today","metric":"count"}', 'attendance'),

-- ── HEADCOUNT: SITE / FIELD ──────────────────────────────────────────────────
('rn how many guys at nikoo?', 'headcount_site', '{"site":"Nikoo Homes","dateScope":"today"}', 'attendance'),
('how many field staff at nikoo today?', 'headcount_site', '{"site":"Nikoo Homes","dateScope":"today","staffCategory":"all"}', 'attendance'),
('nikoo site attendance today', 'headcount_site', '{"site":"Nikoo Homes","dateScope":"today"}', 'attendance'),
('uber verdant manpower today', 'headcount_site', '{"site":"Uber Verdant","dateScope":"today"}', 'attendance'),
('how many security guards on duty at uber?', 'headcount_site', '{"site":"Uber Verdant","dateScope":"today","staffCategory":"security"}', 'attendance'),
('mep staff at nikoo today', 'headcount_site', '{"site":"Nikoo Homes","dateScope":"today","staffCategory":"mep"}', 'attendance'),
('how many workers at exente?', 'headcount_site', '{"site":"iTowers Exente","dateScope":"today"}', 'attendance'),
('site staff count', 'headcount_site', '{"dateScope":"today"}', 'attendance'),
('total field manpower today', 'headcount_enterprise', '{"dateScope":"today"}', 'attendance'),

-- ── LEAVE ────────────────────────────────────────────────────────────────────
('pending leave requests', 'leave_pending_approvals', '{}', 'leave'),
('how many leaves do i have?', 'leave_my_balance', '{}', 'leave'),
('my leave balance', 'leave_my_balance', '{}', 'leave'),
('is kavya on leave today?', 'leave_status_individual', '{"person":"kavya","dateScope":"today"}', 'leave'),
('who is on leave this week?', 'leave_calendar', '{"dateScope":"this_week"}', 'leave'),
('approved leaves for this month', 'leave_calendar', '{"dateScope":"this_month"}', 'leave'),
('how many casual leaves remaining for me?', 'leave_my_balance', '{"leaveType":"casual"}', 'leave'),

-- ── TICKETS / MAINTENANCE ────────────────────────────────────────────────────
('any open tickets?', 'ticket_summary', '{}', 'ticket'),
('show maintenance work orders', 'ticket_summary', '{}', 'ticket'),
('any SLA breaches?', 'ticket_sla_breach', '{}', 'ticket'),
('overdue tickets', 'ticket_sla_breach', '{}', 'ticket'),
('my assigned tickets', 'ticket_my_assigned', '{}', 'ticket'),
('how many open issues?', 'ticket_summary', '{"metric":"count"}', 'ticket'),
('urgent maintenance tasks', 'ticket_summary', '{"metric":"list"}', 'ticket'),

-- ── SOPs ─────────────────────────────────────────────────────────────────────
('how to start the DG?', 'sop_procedure', '{"equipment":"DG Set","action":"startup"}', 'sop'),
('DG startup procedure', 'sop_procedure', '{"equipment":"DG Set","action":"startup"}', 'sop'),
('fire evacuation procedure', 'sop_emergency', '{"emergency_type":"fire"}', 'sop'),
('STP daily checklist', 'sop_checklist', '{"equipment":"STP Plant"}', 'sop'),
('lift entrapment procedure', 'sop_emergency', '{"equipment":"Lift","emergency_type":"entrapment"}', 'sop'),
('security daily checklist', 'sop_checklist', '{"staffCategory":"security"}', 'sop'),

-- ── ONBOARDING ───────────────────────────────────────────────────────────────
('pending onboarding submissions', 'onboarding_status', '{}', 'onboarding'),
('how many kyc pending?', 'onboarding_status', '{}', 'onboarding'),
('onboarding status for kavya', 'onboarding_individual', '{"person":"kavya"}', 'onboarding'),
('total onboarding applications', 'onboarding_status', '{}', 'onboarding'),

-- ── GENERAL ──────────────────────────────────────────────────────────────────
('which shift is running now?', 'shift_current', '{}', 'shift'),
('b shift timings', 'shift_schedule', '{"shift":"B"}', 'shift'),
('night shift arrival time', 'shift_schedule', '{"shift":"C"}', 'shift')

ON CONFLICT DO NOTHING;
