import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function BatchSlotEditor({ onClose, onRefresh }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("batch_slot_settings")
        .select("*")
        .eq("is_active", true)
        .single();
      setSettings(data);
    };
    load();
  }, []);

  if (!settings) return null;

  const save = async () => {
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
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Edit Batch Slots</h3>

        <label>Start Time</label>
        <input
          type="time"
          value={settings.start_time}
          onChange={(e) =>
            setSettings({ ...settings, start_time: e.target.value })
          }
          className="w-full border rounded p-2"
        />

        <label>End Time</label>
        <input
          type="time"
          value={settings.end_time}
          onChange={(e) =>
            setSettings({ ...settings, end_time: e.target.value })
          }
          className="w-full border rounded p-2"
        />

        <label>Interval (minutes)</label>
        <input
          type="number"
          min={30}
          step={15}
          value={settings.interval_minutes}
          onChange={(e) =>
            setSettings({
              ...settings,
              interval_minutes: Number(e.target.value),
            })
          }
          className="w-full border rounded p-2"
        />

        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded"
          >
            Save & Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}
