
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
    console.log('--- SUPABASE DIAGNOSTICS START ---');

    // 1. Get Schema Definitions
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
    const schema = await response.json();
    const tables = Object.keys(schema.definitions);

    console.log(`Found ${tables.length} tables in schema definitions.`);

    const results = {
        readable: [],
        forbidden: [],
        errors: [],
        missing_columns: []
    };

    // 2. Test Table Access
    for (const table of tables) {
        try {
            const { data, error, status } = await supabase.from(table).select('*').limit(1);

            if (status === 403) {
                results.forbidden.push(table);
            } else if (error) {
                results.errors.push({ table, error });
            } else {
                results.readable.push(table);
            }

            // Check for common missing columns or constraints
            const props = schema.definitions[table].properties;
            if (table === 'coupons' && !props.start_date) {
                results.missing_columns.push({ table, column: 'start_date' });
            }
        } catch (e) {
            results.errors.push({ table, error: e.message });
        }
    }

    console.log('\n--- READABILITY REPORT ---');
    console.log('Readable Tables:', results.readable.join(', '));
    console.log('Forbidden (RLS/403) Tables:', results.forbidden.join(', '));

    if (results.errors.length > 0) {
        console.log('\n--- ERROR REPORT ---');
        results.errors.forEach(e => console.log(`[${e.table}] ${JSON.stringify(e.error)}`));
    }

    if (results.missing_columns.length > 0) {
        console.log('\n--- SCHEMA GAPS ---');
        results.missing_columns.forEach(g => console.log(`[${g.table}] Missing ${g.column}`));
    }

    // 3. Test RPCs (known ones)
    const rpcs = ['get_active_members_count', 'replace_member_add_ons'];
    console.log('\n--- RPC CHECK ---');
    for (const rpc of rpcs) {
        const { error } = await supabase.rpc(rpc, {});
        // We expect 400 or parameter errors if we don't pass correct args, but 403/404 means it's missing/locked
        if (error && (error.code === 'PGRST301' || error.code === '42883')) {
            console.log(`[${rpc}] FAILED (Missing or Locked)`);
        } else {
            console.log(`[${rpc}] OK (Exists)`);
        }
    }

    console.log('\n--- SUPABASE DIAGNOSTICS END ---');
}

runDiagnostics();
