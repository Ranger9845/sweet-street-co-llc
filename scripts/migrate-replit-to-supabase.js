import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function showHelp() {
  console.log(`
Usage:
  node scripts/migrate-replit-to-supabase.js <json-file> <table-name> [chunk-size]

Example:
  VITE_SUPABASE_URL=https://<project>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  node scripts/migrate-replit-to-supabase.js ./data/replit-export.json users 100

This script reads a JSON array from a file and inserts the rows into the given Supabase table.
`);
}

async function main() {
  const [fileArg, tableArg, chunkSizeArg] = process.argv.slice(2);
  if (!fileArg || !tableArg) {
    showHelp();
    process.exit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    console.error('Error: VITE_SUPABASE_URL or SUPABASE_URL is required in env.');
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required in env.');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const table = tableArg;
  const chunkSize = parseInt(chunkSizeArg, 10) || 100;

  const raw = await fs.readFile(filePath, 'utf8');
  let records;
  try {
    records = JSON.parse(raw);
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
    process.exit(1);
  }

  if (!Array.isArray(records)) {
    console.error('Error: JSON file must contain an array of records.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log(`Migrating ${records.length} records into table '${table}' in chunks of ${chunkSize}...`);

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`Insert failed for chunk starting at index ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`Inserted chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)`);
  }

  console.log('Migration complete.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
