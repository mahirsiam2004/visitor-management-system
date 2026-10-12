const fs = require('fs');
const path = require('path');

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

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function inspectPassesAndLogs() {
  const { data: passes, error: pErr } = await supabase.from('guest_passes').select('id, purpose, created_at');
  if (pErr) console.error(pErr);
  else {
    console.log(`Total guest passes: ${passes.length}`);
    const jsonPasses = passes.filter(p => p.purpose && p.purpose.startsWith('{'));
    console.log(`Passes with JSON in purpose: ${jsonPasses.length}`);
    jsonPasses.forEach(p => console.log(`  ID: ${p.id} -> ${p.purpose}`));
  }

  const { data: logs, error: lErr } = await supabase.from('entry_logs').select('id, entry_time, exit_time, status, guest_pass_id');
  if (lErr) console.error(lErr);
  else {
    console.log(`\nTotal entry logs: ${logs.length}`);
    logs.forEach(l => console.log(`  Log ID: ${l.id}, pass: ${l.guest_pass_id}, entry: ${l.entry_time}, exit: ${l.exit_time}, status: ${l.status}`));
  }
}

inspectPassesAndLogs().catch(console.error);
