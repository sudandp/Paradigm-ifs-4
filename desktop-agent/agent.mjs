#!/usr/bin/env node
/**
 * Paradigm Office - Work Laptop Companion Agent
 *
 * Responsibilities:
 * 1. Collects unique machine Hardware UUID.
 * 2. Enforces STRICT 1-Laptop-to-1-User exclusive hardware binding.
 * 3. Monitors active foreground window & application usage every 10 seconds.
 * 4. Only tracks during active attendance shift (between punch-in and punch-out).
 * 5. Streams application metrics to Supabase (laptop_app_usage_logs & daily_laptop_productivity_summary).
 */

import { execSync } from 'child_process';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// App categorization helper
function categorizeApplication(processName, windowTitle = '') {
  const p = (processName || '').toLowerCase();
  const w = (windowTitle || '').toLowerCase();

  if (p.includes('code') || p.includes('devenv') || p.includes('idea') || p.includes('webstorm') || p.includes('pycharm') || p.includes('sublime') || p.includes('git') || p.includes('cursor')) {
    return 'Development';
  }
  if (p.includes('chrome') || p.includes('msedge') || p.includes('firefox') || p.includes('brave') || p.includes('safari') || p.includes('opera')) {
    if (w.includes('github') || w.includes('stackoverflow') || w.includes('jira') || w.includes('console') || w.includes('localhost') || w.includes('vercel')) {
      return 'Development';
    }
    return 'Browsing';
  }
  if (p.includes('slack') || p.includes('teams') || p.includes('discord') || p.includes('zoom') || p.includes('telegram') || p.includes('whatsapp') || p.includes('outlook') || p.includes('thunderbird')) {
    return 'Communication';
  }
  if (p.includes('excel') || p.includes('word') || p.includes('powerpnt') || p.includes('onenote') || p.includes('notion') || p.includes('obsidian') || p.includes('trello') || p.includes('docs')) {
    return 'Productivity';
  }
  if (p.includes('figma') || p.includes('photoshop') || p.includes('illustrator') || p.includes('canva') || p.includes('xd') || p.includes('blender')) {
    return 'Design';
  }
  if (p.includes('powershell') || p.includes('cmd') || p.includes('bash') || p.includes('terminal') || p.includes('putty') || p.includes('postman') || p.includes('dbeaver')) {
    return 'Utility';
  }
  return 'Other';
}

// 1. Get Hardware UUID
function getHardwareUUID() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const out = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8' });
      return out.trim();
    } else if (platform === 'darwin') {
      const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { split($0, line, \"\\\"\"); print line[4]; }'", { encoding: 'utf8' });
      return out.trim();
    } else {
      const out = execSync('cat /sys/class/dmi/id/product_uuid 2>/dev/null || cat /etc/machine-id', { encoding: 'utf8' });
      return out.trim();
    }
  } catch (e) {
    return `FALLBACK-${os.hostname()}-${os.userInfo().username}`;
  }
}

// 2. Get Foreground Active Window
function getActiveWindow() {
  const platform = os.platform();
  if (platform === 'win32') {
    const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Text;
  public class ActiveWin {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  }
"@
$hwnd = [ActiveWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[ActiveWin]::GetWindowText($hwnd, $sb, 256) | Out-Null
$pidVal = 0
[ActiveWin]::GetWindowThreadProcessId($hwnd, [ref]$pidVal) | Out-Null
$proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
[PSCustomObject]@{
  Title = $sb.ToString()
  ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
} | ConvertTo-Json -Compress
`;
    try {
      const out = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf8', timeout: 4000 });
      const parsed = JSON.parse(out.trim());
      return {
        processName: parsed.ProcessName || 'Desktop',
        windowTitle: parsed.Title || 'Active Desktop'
      };
    } catch {
      return { processName: 'Desktop', windowTitle: 'Active Desktop' };
    }
  } else if (platform === 'darwin') {
    try {
      const ascript = `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`;
      const name = execSync(ascript, { encoding: 'utf8' }).trim();
      return { processName: name, windowTitle: name };
    } catch {
      return { processName: 'Desktop', windowTitle: 'macOS Desktop' };
    }
  }
  return { processName: 'System', windowTitle: 'Linux Desktop' };
}

// 3. Resolve Target User
async function resolveUser() {
  const args = process.argv.slice(2);
  let userId = null;
  let userEmail = null;

  for (const arg of args) {
    if (arg.startsWith('--user=')) userId = arg.split('=')[1];
    if (arg.startsWith('--email=')) userEmail = arg.split('=')[1];
  }

  if (userId) {
    const { data, error } = await supabase.from('users').select('id, name, email, role').eq('id', userId).single();
    if (error || !data) {
      console.error(`[ERROR] User ID "${userId}" not found in Paradigm database.`);
      process.exit(1);
    }
    return data;
  }

  if (userEmail) {
    const { data, error } = await supabase.from('users').select('id, name, email, role').eq('email', userEmail).single();
    if (error || !data) {
      console.error(`[ERROR] User with email "${userEmail}" not found.`);
      process.exit(1);
    }
    return data;
  }

  // If no arg passed, find the first developer or prompt
  const { data, error } = await supabase.from('users').select('id, name, email, role').limit(1).single();
  if (error || !data) {
    console.error('[ERROR] Please specify user using --user=<user_id> or --email=<email>');
    process.exit(1);
  }
  return data;
}

// 4. Verify 1:1 Laptop Hardware Binding
async function verifyLaptopBinding(user, hardwareUuid) {
  console.log(`\n======================================================`);
  console.log(`🛡️  PARADIGM EXCLUSIVE WORK LAPTOP REGISTRATION GUARD`);
  console.log(`======================================================`);
  console.log(`Employee:      ${user.name} (${user.email})`);
  console.log(`Machine Name:  ${os.hostname()}`);
  console.log(`Hardware UUID: ${hardwareUuid}`);

  // Query user_devices for this hardware_uuid
  const { data: existingDevices, error } = await supabase
    .from('user_devices')
    .select('id, user_id, device_name, status, is_exclusive_laptop')
    .eq('hardware_uuid', hardwareUuid);

  if (!error && existingDevices && existingDevices.length > 0) {
    const boundDevice = existingDevices[0];
    if (boundDevice.user_id !== user.id) {
      // Hardware bound to someone else! BLOCK ACCESS!
      const { data: ownerUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', boundDevice.user_id)
        .single();

      console.error(`\n❌ [SECURITY VIOLATION] ACCESS DENIED!`);
      console.error(`This laptop (${os.hostname()}) is EXCLUSIVELY bound to another employee:`);
      console.error(`Designated Owner: ${ownerUser?.name || boundDevice.user_id} (${ownerUser?.email || ''})`);
      console.error(`Rule: 1 Laptop is strictly allowed for 1 User only.`);
      console.error(`Please contact your System Administrator to unbind this machine.\n`);
      process.exit(1);
    } else {
      console.log(`✅ Machine Verified: Bound exclusively to ${user.name}`);
    }
  } else {
    // Machine not bound yet. Register it exclusively for this user!
    console.log(`📌 Unregistered Laptop detected. Registering exclusively to ${user.name}...`);
    const { error: insertErr } = await supabase.from('user_devices').insert({
      user_id: user.id,
      device_name: `${os.hostname()} (Work Laptop)`,
      device_type: 'web',
      device_identifier: `hw-${hardwareUuid.toLowerCase()}`,
      hardware_uuid: hardwareUuid,
      is_exclusive_laptop: true,
      status: 'active',
      device_info: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalmemGb: Math.round(os.totalmem() / (1024 * 1024 * 1024))
      }
    });

    if (insertErr) {
      console.warn(`[WARN] Could not persist exclusive binding into user_devices:`, insertErr.message);
    } else {
      console.log(`✅ Laptop successfully bound exclusively to ${user.name}!`);
    }
  }
}

// 5. Main Tracking Loop
async function startTrackingLoop(user, hardwareUuid) {
  const SAMPLE_INTERVAL_MS = 10000; // 10 seconds
  console.log(`\n🚀 Productivity Tracker started. Sampling active windows every 10s...`);
  console.log(`Press Ctrl+C to terminate.\n`);

  setInterval(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if user has an active punch-in today
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id, is_active, check_out, check_in')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const isShiftActive = attendance && (attendance.is_active === true || !attendance.check_out);

      if (!isShiftActive) {
        process.stdout.write(`\r⏸️  [PAUSED] ${new Date().toLocaleTimeString()} - No active punch-in found for today (${today}). Waiting...`);
        return;
      }

      // Sample active window
      const win = getActiveWindow();
      const category = categorizeApplication(win.processName, win.windowTitle);

      // Save usage log
      const { error: logErr } = await supabase.from('laptop_app_usage_logs').insert({
        user_id: user.id,
        hardware_uuid: hardwareUuid,
        app_name: win.processName,
        process_name: win.processName,
        window_title: win.windowTitle,
        category: category,
        duration_seconds: 10,
        is_idle: false,
        shift_date: today
      });

      if (logErr) {
        // Table may not have migration run yet or transient error
        process.stdout.write(`\r⚠️  [LOG FAILED] ${logErr.message.slice(0, 40)}`);
      } else {
        process.stdout.write(`\r⏱️  [${new Date().toLocaleTimeString()}] Active App: [${category}] ${win.processName} - "${(win.windowTitle || '').slice(0, 35)}..."    `);
      }
    } catch (e) {
      // Non-blocking
    }
  }, SAMPLE_INTERVAL_MS);
}

// Run
(async () => {
  try {
    const user = await resolveUser();
    const hardwareUuid = getHardwareUUID();
    await verifyLaptopBinding(user, hardwareUuid);
    await startTrackingLoop(user, hardwareUuid);
  } catch (err) {
    console.error('Fatal agent error:', err);
    process.exit(1);
  }
})();
