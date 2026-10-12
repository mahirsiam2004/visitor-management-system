const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"](.*)['"]$/, '$1');
    env[match[1]] = value;
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, serviceKey);

async function checkDatabase() {
  const tables = [
    'profiles', 'guest_passes', 'entry_logs', 'audit_log',
    'access_attempts', 'guard_rate_limits', 'notifications',
    'guest_pass_members', 'recurring_visitors', 'recurring_visitor_apartments',
    'visit_requests', 'events', 'event_guests', 'event_coordinators',
    'blacklist', 'policy_settings', 'pass_extensions', 'penalties',
    'notification_preferences', 'buildings', 'guard_shifts', 'family_members',
    'apartments'
  ];

  console.log('--- CHECKING LIVE SUPABASE TABLES ---');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ ${table}: Exists! (${data.length} sample row fetched)`);
    }
  }

  // Also check guest_passes columns by fetching 1 row
  const { data: passes } = await supabase.from('guest_passes').select('*').limit(1);
  if (passes && passes.length > 0) {
    console.log('\nguest_passes sample row columns:', Object.keys(passes[0]));
    console.log('Sample purpose:', passes[0].purpose);
  }

  const { data: entries } = await supabase.from('entry_logs').select('*').limit(1);
  if (entries && entries.length > 0) {
    console.log('\nentry_logs sample row columns:', Object.keys(entries[0]));
  }
}

checkDatabase().catch(console.error);
