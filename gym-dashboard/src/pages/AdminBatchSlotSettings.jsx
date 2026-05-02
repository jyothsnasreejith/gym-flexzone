import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminBatchSlotSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("batch_slot_settings")
        .select("*")
        .eq("is_active", true)
        .single();

      if (!error) setSettings(data);
      setLoading(false);
    };

    loadSettings();
  }, []);

  const saveAndRegenerate = async () => {
    if (!settings) return;
    setSaving(true);

    await supabase
      .from("batch_slot_settings")
      .update({
        start_time: settings.start_time,
        end_time: settings.end_time,
        interval_minutes: settings.interval_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    await supabase.rpc("regenerate_batch_slots");

    setSaving(false);
    alert("Batch slots regenerated successfully");
  };

  if (loading) {
    return <div className="p-6 text-secondary">Loading…</div>;
  }

  if (!settings) {
    return (
      <div className="p-6 text-red-600">
        Failed to load batch slot settings.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 bg-navy">
      <div>
        <h1 className="text-2xl font-bold">Batch Slot Settings</h1>
        <p className="text-secondary text-sm">
          Configure the operating window and interval for batch slots.
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm text-secondary">Start Time</label>
          <input
            type="time"
            value={settings.start_time || ""}
            onChange={(e) =>
              setSettings({ ...settings, start_time: e.target.value })
            }
            className="mt-1 w-full rounded-md border border-secondary-blue px-3 py-2 bg-transparent text-white"
          />
        </div>

        <div>
          <label className="text-sm text-secondary">End Time</label>
          <input
            type="time"
            value={settings.end_time || ""}
            onChange={(e) =>
              setSettings({ ...settings, end_time: e.target.value })
            }
            className="mt-1 w-full rounded-md border border-secondary-blue px-3 py-2 bg-transparent text-white"
          />
        </div>

        <div>
          <label className="text-sm text-secondary">
            Interval (minutes)
          </label>
          <input
            type="number"
            min={30}
            step={15}
            value={settings.interval_minutes ?? 0}
            onChange={(e) =>
              setSettings({
                ...settings,
                interval_minutes: Number(e.target.value),
              })
            }
            className="mt-1 w-full rounded-md border border-secondary-blue px-3 py-2 bg-transparent text-white"
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This will regenerate all batch slots. Existing members will keep
          their assigned slot IDs, but labels may change.
        </div>

        <button
          type="button"
          onClick={saveAndRegenerate}
          disabled={saving}
          className="h-10 px-4 rounded-lg bg-primary text-white font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Regenerate Slots"}
        </button>
      </div>
    </div>
  );
}
