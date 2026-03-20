// supabase/functions/system-backup-manager/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch current settings
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('api_settings')
      .eq('id', 'singleton')
      .single();

    if (settingsError || !settingsData) {
      throw new Error(`Failed to fetch settings: ${settingsError?.message}`);
    }

    const apiSettings = settingsData.api_settings;
    if (!apiSettings?.auto_backup_enabled) {
      return new Response(JSON.stringify({ message: 'Auto-backup is disabled.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const schedule = apiSettings.backup_schedule;
    if (!schedule) {
      return new Response(JSON.stringify({ message: 'No backup schedule configured.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check if backup is due
    const now = new Date();
    const nextRun = schedule.next_run ? new Date(schedule.next_run) : null;
    
// If nextRun is null, calculate it for the first time
    if (!nextRun) {
      const initialNextRun = calculateNextRun(now, schedule, true);
      console.log(`First run scheduled for: ${initialNextRun.toISOString()}`);
      
      // Update settings with first scheduled run
      await updateNextRun(supabaseAdmin, apiSettings, initialNextRun);
      
      // If it's still in the future, wait
      if (initialNextRun > now) {
        return new Response(JSON.stringify({ message: `First backup scheduled for ${initialNextRun.toISOString()}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (nextRun > now) {
      return new Response(JSON.stringify({ message: `Next backup scheduled for ${nextRun.toISOString()}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Backup triggered at ${now.toISOString()}`);

    // [Perform Backup Logic remains the same...]
    const { data: tables, error: tablesError } = await supabaseAdmin.rpc('get_public_tables');
    
    if (tablesError) {
      throw new Error(`Failed to fetch tables: ${tablesError.message}`);
    }

    const backupData: Record<string, any> = {};
    for (const table of tables) {
      const { data, error } = await supabaseAdmin.from(table).select('*');
      if (error) {
        console.error(`Error backing up table ${table}:`, error);
        continue;
      }
      backupData[table] = data;
    }

    const today = now.toLocaleDateString('en-GB').replace(/\//g, '-');
    const { data: existingBackups } = await supabaseAdmin
      .from('system_backups')
      .select('name')
      .ilike('name', `Paradigm ${today} backup %`);
    
    const count = (existingBackups?.length || 0) + 1;
    const backupName = `Paradigm ${today} backup ${count}`;
    const fileName = `restoration_points/backup_${Date.now()}.json`;

    await supabaseAdmin.storage
      .from('backups')
      .upload(fileName, JSON.stringify(backupData, null, 2), {
        contentType: 'application/json'
      });

    await supabaseAdmin.from('system_backups').insert({
      name: backupName,
      snapshot_path: fileName,
      size_bytes: JSON.stringify(backupData).length,
      created_by_name: 'System Scheduler'
    });

    // 4. Update Schedule for next run
    const calculatedNextRun = calculateNextRun(now, schedule);
    await updateNextRun(supabaseAdmin, apiSettings, calculatedNextRun, now);

    return new Response(JSON.stringify({ 
      message: 'Backup completed successfully.',
      name: backupName,
      next_run: calculatedNextRun.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backup Manager Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateNextRun(baseDate: Date, schedule: any, isInitial: boolean = false): Date {
  const [hours, minutes] = schedule.start_time.split(':').map(Number);
  let next = new Date(baseDate);
  next.setHours(hours, minutes, 0, 0);

  // If we are calculating from "now" and the time has already passed today, 
  // we move to the next increment unless it's the very first initialization.
  if (!isInitial && next <= baseDate) {
    next = moveNext(next, schedule);
  } else if (isInitial && next <= baseDate) {
     // For initial, if today's time passed, start from next cycle
     next = moveNext(next, schedule);
  }

  // Frequency specific alignment
  switch (schedule.frequency) {
    case 'weekly':
      // Align to the specific day of week
      while (next.getDay() !== (schedule.day_of_week ?? 0)) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'monthly':
      // Align to the specific day of month
      next.setDate(schedule.day_of_month ?? 1);
      // If setting the date pushes us back (e.g., today is 15th, but we want 1st), 
      // we need to move to next month/interval.
      if (next <= baseDate) {
        next.setMonth(next.getMonth() + (schedule.interval ?? 1));
      }
      break;
    case 'yearly':
      next.setMonth((schedule.month_of_year ?? 1) - 1);
      next.setDate(schedule.day_of_month ?? 1);
      if (next <= baseDate) {
        next.setFullYear(next.getFullYear() + 1);
      }
      break;
  }

  return next;
}

function moveNext(date: Date, schedule: any): Date {
  const next = new Date(date);
  switch (schedule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + (schedule.interval ?? 1));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

async function updateNextRun(supabase: any, currentSettings: any, nextRun: Date, lastRun?: Date) {
  const updatedSchedule = {
    ...currentSettings.backup_schedule,
    next_run: nextRun.toISOString(),
    last_run: lastRun ? lastRun.toISOString() : currentSettings.backup_schedule?.last_run
  };

  const updatedSettings = {
    ...currentSettings,
    backup_schedule: updatedSchedule
  };

  await supabase
    .from('settings')
    .upsert({ id: 'singleton', api_settings: updatedSettings });
}
