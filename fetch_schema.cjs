const fs = require('fs');

const supabaseUrl = 'https://qjkvvbuububgqgljsyjb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqa3Z2YnV1YnViZ3FnbGpzeWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mjc2MjUsImV4cCI6MjA4MTEwMzYyNX0.2xiOIszNSEIfL11iitC8mR1-Pnp5rZnY2Ni9huBVTmc';

async function fetchSchema() {
  console.log("Fetching schema...");
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
    if (!response.ok) {
        console.error("Fetch failed with status:", response.status);
        const text = await response.text();
        console.error("Response body:", text);
        return;
    }
    const schema = await response.json();
    fs.writeFileSync('current_schema.json', JSON.stringify(schema, null, 2));
    console.log("SUCCESS: Schema written to current_schema.json");
    
    // Check for bills.is_current
    const bills = schema.definitions.bills;
    if (bills) {
        if (bills.properties.is_current) {
            console.log("BILLS: 'is_current' column EXISTS.");
        } else {
            console.log("BILLS: 'is_current' column MISSING.");
        }
    } else {
        console.log("BILLS: table NOT FOUND in schema.");
    }
  } catch (e) {
    console.error("Unexpected error:", e.message);
  }
}

fetchSchema();
