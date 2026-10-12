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

async function checkPhones() {
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone_number');
  console.log('Profiles phones:');
  profiles.forEach(p => console.log(`  ${p.full_name}: "${p.phone_number}"`));

  const { data: passes } = await supabase.from('guest_passes').select('id, guest_name, guest_phone');
  console.log('Guest passes phones:');
  passes.forEach(p => console.log(`  ${p.guest_name}: "${p.guest_phone}"`));
}

checkPhones().catch(console.error);
