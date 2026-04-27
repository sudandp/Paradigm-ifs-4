-- Enable RLS for scheduled_notifications
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view scheduled notifications' AND tablename = 'scheduled_notifications'
  ) THEN
    CREATE POLICY "Users can view scheduled notifications"
      ON public.scheduled_notifications FOR SELECT
      TO authenticated
      USING (
        auth.uid() = created_by 
        OR auth.uid() = ANY(target_user_ids)
        OR EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND (users.role_id = scheduled_notifications.target_role OR scheduled_notifications.target_role = 'all')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own scheduled notifications' AND tablename = 'scheduled_notifications'
  ) THEN
    CREATE POLICY "Users can insert their own scheduled notifications"
      ON public.scheduled_notifications FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own scheduled notifications' AND tablename = 'scheduled_notifications'
  ) THEN
    CREATE POLICY "Users can update their own scheduled notifications"
      ON public.scheduled_notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own scheduled notifications' AND tablename = 'scheduled_notifications'
  ) THEN
    CREATE POLICY "Users can delete their own scheduled notifications"
      ON public.scheduled_notifications FOR DELETE
      TO authenticated
      USING (auth.uid() = created_by);
  END IF;
END$$;

-- Enable RLS for user_documents
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Policies for user_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own documents' AND tablename = 'user_documents'
  ) THEN
    CREATE POLICY "Users can manage their own documents"
      ON public.user_documents FOR ALL
      TO authenticated
      USING (auth.uid()::text = user_id::text)
      WITH CHECK (auth.uid()::text = user_id::text);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins and HR can view all documents' AND tablename = 'user_documents'
  ) THEN
    CREATE POLICY "Admins and HR can view all documents"
      ON public.user_documents FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() AND users.role_id IN ('admin', 'hr', 'operation_manager')
        )
      );
  END IF;
END$$;
