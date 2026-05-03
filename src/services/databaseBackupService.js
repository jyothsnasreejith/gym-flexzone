import { supabase } from "../supabaseClient";

/**
 * Comprehensive Database Backup Service
 * Exports: Tables, Columns, Indexes, Constraints, RLS Policies, Functions, Triggers, and Data
 */

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

      // Get all user-defined tables (excluding Supabase internal tables)
      const { data: tables, error: tablesError } = await supabase
        .rpc("get_backup_tables");

      if (tablesError) {
        console.error("Error fetching tables:", tablesError);
        // Fallback to manual table list
        const tableNames = await this.getTableList();
        return await this.generateBackupFromTables(tableNames, backupName);
      }

      // Get table schemas and create statements
      const tableSchemas = await this.getTableSchemas();
      sqlContent += "-- ============================================\n";
      sqlContent += "-- TABLE DEFINITIONS\n";
      sqlContent += "-- ============================================\n\n";
      sqlContent += tableSchemas + "\n";

      // Get indexes
      const indexes = await this.getIndexDefinitions();
      if (indexes) {
        sqlContent += "-- ============================================\n";
        sqlContent += "-- INDEXES\n";
        sqlContent += "-- ============================================\n\n";
        sqlContent += indexes + "\n";
      }

      // Get constraints
      const constraints = await this.getConstraintDefinitions();
      if (constraints) {
        sqlContent += "-- ============================================\n";
        sqlContent += "-- CONSTRAINTS\n";
        sqlContent += "-- ============================================\n\n";
        sqlContent += constraints + "\n";
      }

      // Get RLS policies
      const policies = await this.getRLSPolicies();
      if (policies) {
        sqlContent += "-- ============================================\n";
        sqlContent += "-- ROW LEVEL SECURITY POLICIES\n";
        sqlContent += "-- ============================================\n\n";
        sqlContent += policies + "\n";
      }

      // Get functions and triggers
      const functions = await this.getFunctionsAndTriggers();
      if (functions) {
        sqlContent += "-- ============================================\n";
        sqlContent += "-- FUNCTIONS AND TRIGGERS\n";
        sqlContent += "-- ============================================\n\n";
        sqlContent += functions + "\n";
      }

      // Get seed data
      sqlContent += "-- ============================================\n";
      sqlContent += "-- SEED DATA\n";
      sqlContent += "-- ============================================\n\n";
      const seedData = await this.exportAllData();
      sqlContent += seedData + "\n";

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

      // Get list of all tables
      const tableNames = await this.getTableList();

      // Export each table's data
      for (const tableName of tableNames) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*");

        if (!error && data) {
          backup.tables[tableName] = data;
        }
      }

      // Get schema information
      backup.schema = {
        tables: await this.getTableSchemaJson(),
        indexes: await this.getIndexesJson(),
        constraints: await this.getConstraintsJson(),
        policies: await this.getPoliciesJson(),
        functions: await this.getFunctionsJson()
      };

      const jsonContent = JSON.stringify(backup, null, 2);
      await this.downloadFile(jsonContent, backupName, "application/json");

      return { success: true, message: `Backup created: ${backupName}` };
    } catch (err) {
      console.error("Error generating JSON backup:", err);
      throw new Error(`Failed to generate JSON backup: ${err.message}`);
    }
  },

  /**
   * Get list of all user-defined tables
   */
  async getTableList() {
    try {
      const { data: tables } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .not("table_name", "like", "pg_%")
        .not("table_name", "like", "%\\_meta");

      return (tables || [])
        .map(t => t.table_name)
        .sort();
    } catch (err) {
      // Fallback: hardcoded table list based on your schema
      return [
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
    }
  },

  /**
   * Get table definitions (CREATE TABLE statements)
   */
  async getTableSchemas() {
    try {
      const tableNames = await this.getTableList();
      let schemas = "";

      for (const tableName of tableNames) {
        const { data: columns } = await supabase
          .from("information_schema.columns")
          .select("column_name, data_type, is_nullable, column_default")
          .eq("table_schema", "public")
          .eq("table_name", tableName)
          .order("ordinal_position");

        if (columns && columns.length > 0) {
          schemas += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
          
          const columnDefs = columns.map(col => {
            let def = `  "${col.column_name}" ${col.data_type}`;
            if (col.is_nullable === "NO") def += " NOT NULL";
            if (col.column_default) def += ` DEFAULT ${col.column_default}`;
            return def;
          }).join(",\n");

          schemas += columnDefs + "\n);\n\n";
        }
      }

      return schemas;
    } catch (err) {
      console.error("Error getting table schemas:", err);
      return "";
    }
  },

  /**
   * Get index definitions
   */
  async getIndexDefinitions() {
    try {
      const { data: indexes } = await supabase
        .rpc("get_indexes_sql");

      if (indexes) {
        return indexes.map(idx => `CREATE INDEX IF NOT EXISTS ${idx.indexname} ON ${idx.tablename} (${idx.indexdef});`).join("\n");
      }

      return "";
    } catch (err) {
      console.error("Error getting indexes:", err);
      return "";
    }
  },

  async getIndexesJson() {
    try {
      const tableNames = await this.getTableList();
      const indexes = {};

      for (const tableName of tableNames) {
        const { data } = await supabase
          .rpc("get_table_indexes", { table_name: tableName });

        if (data) {
          indexes[tableName] = data;
        }
      }

      return indexes;
    } catch (err) {
      console.error("Error getting indexes JSON:", err);
      return {};
    }
  },

  /**
   * Get constraint definitions
   */
  async getConstraintDefinitions() {
    try {
      const tableNames = await this.getTableList();
      let constraints = "";

      for (const tableName of tableNames) {
        const { data } = await supabase
          .rpc("get_table_constraints", { table_name: tableName });

        if (data && data.length > 0) {
          data.forEach(constraint => {
            constraints += `-- Constraint: ${constraint.constraint_name}\n`;
            constraints += `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraint.constraint_name}" ${constraint.constraint_type};\n\n`;
          });
        }
      }

      return constraints;
    } catch (err) {
      console.error("Error getting constraints:", err);
      return "";
    }
  },

  async getConstraintsJson() {
    try {
      const tableNames = await this.getTableList();
      const constraints = {};

      for (const tableName of tableNames) {
        const { data } = await supabase
          .rpc("get_table_constraints", { table_name: tableName });

        if (data) {
          constraints[tableName] = data;
        }
      }

      return constraints;
    } catch (err) {
      console.error("Error getting constraints JSON:", err);
      return {};
    }
  },

  /**
   * Get RLS policies
   */
  async getRLSPolicies() {
    try {
      const { data: policies } = await supabase
        .rpc("get_rls_policies");

      if (policies && policies.length > 0) {
        return policies.map(p => 
          `-- RLS Policy: ${p.policyname} on ${p.tablename}\n` +
          `${p.policy_definition || ""}\n`
        ).join("\n");
      }

      return "";
    } catch (err) {
      console.error("Error getting RLS policies:", err);
      return "";
    }
  },

  async getPoliciesJson() {
    try {
      const { data: policies } = await supabase
        .rpc("get_rls_policies");

      return policies || [];
    } catch (err) {
      console.error("Error getting policies JSON:", err);
      return [];
    }
  },

  /**
   * Get functions and triggers
   */
  async getFunctionsAndTriggers() {
    try {
      const { data: functions } = await supabase
        .rpc("get_functions_and_triggers");

      if (functions && functions.length > 0) {
        return functions.map(f => 
          `-- Function/Trigger: ${f.name}\n${f.definition}\n`
        ).join("\n");
      }

      return "";
    } catch (err) {
      console.error("Error getting functions and triggers:", err);
      return "";
    }
  },

  async getFunctionsJson() {
    try {
      const { data: functions } = await supabase
        .rpc("get_functions_and_triggers");

      return functions || [];
    } catch (err) {
      console.error("Error getting functions JSON:", err);
      return [];
    }
  },

  /**
   * Get table schema as JSON
   */
  async getTableSchemaJson() {
    try {
      const tableNames = await this.getTableList();
      const schema = {};

      for (const tableName of tableNames) {
        const { data: columns } = await supabase
          .from("information_schema.columns")
          .select("column_name, data_type, is_nullable, column_default")
          .eq("table_schema", "public")
          .eq("table_name", tableName)
          .order("ordinal_position");

        if (columns) {
          schema[tableName] = columns;
        }
      }

      return schema;
    } catch (err) {
      console.error("Error getting table schema JSON:", err);
      return {};
    }
  },

  /**
   * Export all data as INSERT statements
   */
  async exportAllData() {
    try {
      const tableNames = await this.getTableList();
      let insertStatements = "";

      for (const tableName of tableNames) {
        const { data: rows } = await supabase
          .from(tableName)
          .select("*");

        if (rows && rows.length > 0) {
          insertStatements += `-- Data for table: ${tableName}\n`;
          
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
        }
      }

      return insertStatements;
    } catch (err) {
      console.error("Error exporting data:", err);
      return "";
    }
  },

  /**
   * Fallback method to generate backup from table list
   */
  async generateBackupFromTables(tableNames, backupName) {
    try {
      let sqlContent = "-- Gym Dashboard Database Backup (Fallback Mode)\n";
      sqlContent += `-- Generated: ${new Date().toLocaleString()}\n`;
      sqlContent += "-- This backup includes all accessible tables and data\n\n";

      // Add table data
      const seedData = await this.exportAllData();
      sqlContent += seedData;

      await this.downloadFile(sqlContent, backupName, "text/plain");
      return { success: true, message: `Backup created: ${backupName}` };
    } catch (err) {
      throw new Error(`Failed to generate backup: ${err.message}`);
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
