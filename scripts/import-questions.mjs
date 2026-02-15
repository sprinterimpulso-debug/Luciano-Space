import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const backupArg = process.argv[2];
const backupsDir = path.resolve('/Users/felipe/Desktop/LUCIANO SPACE/backups');
let backupFile = backupArg;

if (!backupFile) {
  const candidates = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith('questions-backup-') && f.endsWith('.json'))
    .sort();
  backupFile = candidates.length > 0 ? path.join(backupsDir, candidates[candidates.length - 1]) : '';
}

if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('Backup file not found. Pass path as first argument.');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
if (!Array.isArray(payload)) {
  console.error('Invalid backup format. Expected JSON array.');
  process.exit(1);
}

const rows = payload.map((row) => ({
  id: row.id,
  author: row.author ?? 'Anônimo',
  text: row.text ?? '',
  status: row.status ?? 'PENDING',
  answer: row.answer ?? null,
  video_url: row.video_url ?? null,
  created_at: row.created_at ?? new Date().toISOString(),
}));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const batchSize = 200;
let imported = 0;

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const { error } = await supabase
    .from('questions')
    .upsert(batch, { onConflict: 'id' });

  if (error) {
    console.error(`Import failed at batch ${i / batchSize + 1}:`, error.message);
    process.exit(1);
  }

  imported += batch.length;
  console.log(`Imported ${imported}/${rows.length}`);
}

console.log(`Done. Imported ${imported} records from ${backupFile}`);
