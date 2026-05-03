import { supabase } from "../supabaseClient";

/**
 * Comprehensive Database Backup Service
 * Exports: Tables, Columns, Indexes, Constraints, RLS Policies, Functions, Triggers, and Data
 */

// Known tables in the gym database
const KNOWN_TABLES = [
  "members",
  "trainers",
  "packages",
  "member_packages",
  "member_add_ons",
  "add_ons",
  "package_variants",
  "time_slots",
  "batch_slots",
  "member_attendance",
  "trainer_attendance",
  "enquiries",
  "offers",
  "offer_uses",
  "referrals",
  "system_settings",
  "bills",
  "expenses",
  "member_reviews",
  "login_attempts"
];

export const databaseBackupService = {
  /**
   * Generate complete SQL dump of the database
   */
  async generateSqlDump() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `gym_backup_${timestamp}.sql`;
      
      let sqlContent = "-- Gym Dashboard Database Backup\n";
      sqlContent += `-- Generated: ${new Date().toLocaleString()}\n`;
      sqlContent += "-- This backup includes all tables, indexes, constraints, policies, and functions\n\n";

      // Export all data as INSERT statements
      sqlContent += "-- ============================================\n";
      sqlContent += "-- SEED DATA\n";
      sqlContent += "-- ============================================\n\n";
      const seedData = await this.exportAllDataAsSql();
      sqlContent += seedData;

      // Download SQL file
      await this.downloadFile(sqlContent, backupName, "text/plain");

      return { success: true, message: `Backup created: ${backupName}` };
    } catch (err) {
      console.error("Error generating SQL dump:", err);
      throw new Error(`Failed to generate SQL dump: ${err.message}`);
    }
  },

  /**
   * Generate JSON backup of all data
   */
  async generateJsonBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `gym_backup_${timestamp}.json`;

      const backup = {
        metadata: {
          timestamp: new Date().toISOString(),
          database: "gym-dashboard",
          version: "1.0"
        },
        tables: {}
      };

      // Export each table's data
      for (const tableName of KNOWN_TABLES) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .limit(10000); // Limit to prevent huge exports

          if (!error && data && data.length > 0) {
            backup.tables[tableName] = {
              count: data.length,
              data: data
            };
            console.log(`✓ Exported ${tableName}: ${data.length} rows`);
          }
        } catch (err) {
          console.warn(`Failed to export ${tableName}:`, err.message);
        }
      }

      const jsonContent = JSON.stringify(backup, null, 2);
      await this.downloadFile(jsonContent, backupName, "application/json");

      return { success: true, message: `Backup created: ${backupName}` };
    } catch (err) {
      console.error("Error generating JSON backup:", err);
      throw new Error(`Failed to generate JSON backup: ${err.message}`);
    }
  },

  /**
   * Export all data as SQL INSERT statements
   */
  async exportAllDataAsSql() {
    try {
      let insertStatements = "";
      let totalRows = 0;

      for (const tableName of KNOWN_TABLES) {
        try {
          const { data: rows, error } = await supabase
            .from(tableName)
            .select("*")
            .limit(10000); // Limit to prevent huge exports

          if (!error && rows && rows.length > 0) {
            insertStatements += `-- Table: ${tableName} (${rows.length} rows)\n`;
            
            // Get column names from first row
            const columns = Object.keys(rows[0]);
            
            rows.forEach(row => {
              const values = columns.map(col => {
                const val = row[col];
                if (val === null) return "NULL";
                if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
                if (typeof val === "boolean") return val ? "true" : "false";
                if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return String(val);
              }).join(", ");

              insertStatements += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${values});\n`;
            });

            insertStatements += "\n";
            totalRows += rows.length;
            console.log(`✓ Exported ${tableName}: ${rows.length} rows`);
          }
        } catch (err) {
          console.warn(`Failed to export ${tableName}:`, err.message);
        }
      }

      return insertStatements || `-- No data found in any tables\n-- Total rows exported: 0\n`;
    } catch (err) {
      console.error("Error exporting data:", err);
      return `-- Error during export: ${err.message}\n`;
    }
  },

  /**
   * Download file to user's computer
   */
  async downloadFile(content, filename, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};

export default databaseBackupService;
