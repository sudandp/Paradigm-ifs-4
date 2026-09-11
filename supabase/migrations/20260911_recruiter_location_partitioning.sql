-- Migration: Recruiter Location Partitioning (Bangalore & Hyderabad)
-- Configures recruiters to their regional entities and branches

-- Ensure Dasari Venkatesh (hr.hyd@paradigmfms.com) is designated as Hyderabad HR Recruiter
UPDATE public.users
SET 
    role_id = 'hr_recruitment',
    society_id = 'comp_1775122124670',
    society_name = 'PARADIGM INTEGRATED FACILITY SERVICES PVT LTD (HYD)',
    reporting_manager_id = 'f06f05d9-cf5f-4e4d-a0b4-9534fd2d1e7b'
WHERE email = 'hr.hyd@paradigmfms.com' OR id = 'f2c1dd83-32d6-45e2-9fff-2ab9ef77a540';

-- Ensure Bangalore Recruiters are mapped to Bangalore company (comp_1774006215885)
UPDATE public.users
SET society_id = 'comp_1774006215885'
WHERE role_id = 'hr_recruitment' AND id != 'f2c1dd83-32d6-45e2-9fff-2ab9ef77a540';
