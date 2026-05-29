-- Migration: Fix CRM Foreign Key Constraints to point to public.users instead of auth.users
-- Date: 2026-05-29
-- Description: Updates crm_leads, crm_followups, crm_checklist_templates, crm_checklist_submissions, 
--              and crm_quotations to reference public.users(id) instead of auth.users(id).
--              Cleans up any orphaned reference values (like dummy seed IDs) by setting them to NULL
--              prior to applying the constraint to prevent referential integrity violations.

DO $$
DECLARE
    r RECORD;
    t_name text;
    col_name text;
    -- Array of [table_name, column_name] representing foreign keys to update
    tables_cols text[][] := ARRAY[
        ['crm_leads', 'assigned_to'],
        ['crm_leads', 'created_by'],
        ['crm_followups', 'created_by'],
        ['crm_checklist_templates', 'created_by'],
        ['crm_checklist_submissions', 'submitted_by'],
        ['crm_checklist_submissions', 'reviewed_by'],
        ['crm_quotations', 'approved_by'],
        ['crm_quotations', 'created_by']
    ];
    i integer;
BEGIN
    FOR i IN 1 .. array_upper(tables_cols, 1) LOOP
        t_name := tables_cols[i][1];
        col_name := tables_cols[i][2];
        
        -- Find and drop any existing foreign key constraints on the column
        FOR r IN 
            SELECT tc.constraint_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = t_name 
              AND kcu.column_name = col_name
              AND tc.constraint_type = 'FOREIGN KEY'
        LOOP
            EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END LOOP;
        
        -- Clean up orphaned references (set to NULL) that do not exist in public.users
        EXECUTE 'UPDATE public.' || quote_ident(t_name) || 
                ' SET ' || quote_ident(col_name) || ' = NULL ' ||
                ' WHERE ' || quote_ident(col_name) || ' IS NOT NULL ' ||
                ' AND ' || quote_ident(col_name) || ' NOT IN (SELECT id FROM public.users)';
        
        -- Add the correct foreign key constraint to public.users
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || 
                ' ADD CONSTRAINT ' || quote_ident(t_name || '_' || col_name || '_fkey') || 
                ' FOREIGN KEY (' || quote_ident(col_name) || ') REFERENCES public.users(id) ON DELETE SET NULL';
    END LOOP;
END $$;
