import React, { useState } from "react";
import databaseBackupService from "../../services/databaseBackupService";
import { useToast } from "../../context/ToastContext";

export default function DatabaseBackupSettings() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupFormat, setBackupFormat] = useState("sql"); // "sql" or "json"
  const { showToast } = useToast();

  const handleBackup = async () => {
    if (!window.confirm("This will download a complete database backup. Continue?")) {
      return;
    }

    setIsBackingUp(true);
    try {
      let result;
      if (backupFormat === "sql") {
        result = await databaseBackupService.generateSqlDump();
      } else {
        result = await databaseBackupService.generateJsonBackup();
      }

      showToast(result.message, "success");
    } catch (err) {
      console.error("Backup error:", err);
      showToast(
        err.message || "Failed to create database backup",
        "error"
      );
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-2">Database Backup</h2>
        <p className="text-sm text-secondary">
          Download a complete backup of your database including all tables, indexes, constraints,
          RLS policies, functions, triggers, and seed data.
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Backup Format Selection */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">
            Backup Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="format"
                value="sql"
                checked={backupFormat === "sql"}
                onChange={(e) => setBackupFormat(e.target.value)}
                className="w-4 h-4 text-primary cursor-pointer"
              />
              <span className="ml-2 text-sm text-white">
                SQL Format
                <span className="text-xs text-secondary block">
                  Complete SQL dump with all schema and data
                </span>
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="format"
                value="json"
                checked={backupFormat === "json"}
                onChange={(e) => setBackupFormat(e.target.value)}
                className="w-4 h-4 text-primary cursor-pointer"
              />
              <span className="ml-2 text-sm text-white">
                JSON Format
                <span className="text-xs text-secondary block">
                  Structured data with metadata
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Backup Information */}
        <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg p-4 my-4">
          <h3 className="text-sm font-semibold text-white mb-3">Backup Includes:</h3>
          <ul className="text-xs text-secondary space-y-1 grid grid-cols-2 gap-2">
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> All Tables
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Columns & Datatypes
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Primary Keys
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Foreign Keys
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Indexes
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Constraints
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> RLS Policies
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Functions
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> Triggers
            </li>
            <li className="flex items-center">
              <span className="text-primary mr-2">✓</span> All Seed Data
            </li>
          </ul>
        </div>

        {/* Warning */}
        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-3">
          <p className="text-xs text-yellow-200">
            <strong>Note:</strong> Backup files contain sensitive data including user information.
            Store securely and restrict access.
          </p>
        </div>

        {/* Backup Button */}
        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
            isBackingUp
              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary-dark text-white cursor-pointer"
          }`}
        >
          {isBackingUp ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Creating Backup...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>📥</span>
              Download Database Backup
            </span>
          )}
        </button>

        {/* File Info */}
        <div className="text-xs text-secondary bg-gray-900 bg-opacity-30 rounded-lg p-3">
          <p>
            <strong>File Format:</strong> {backupFormat === "sql" ? "SQL Script (.sql)" : "JSON Data (.json)"}
          </p>
          <p>
            <strong>Naming Convention:</strong> gym_backup_YYYY-MM-DD_HH-MM-SS.{backupFormat}
          </p>
          <p className="mt-2">
            Backup files are generated with a timestamp and can be imported back into your database
            for disaster recovery or migration purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
