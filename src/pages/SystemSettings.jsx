import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import LocationSettings from "../components/settings/LocationSettings";
import { useToast } from "../context/ToastContext";

const TABS = {
  ATTENDANCE_CONFIG: "attendance_config",
};

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState(TABS.ATTENDANCE_CONFIG);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">
          Control Center
        </h1>
        <p className="text-secondary mt-1">
          View system configuration, master data, and reference information.
        </p>
      </div>


      <div className="bg-card border rounded-xl p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">
          Quick Links
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink label="Members" to="/members" />
          <QuickLink label="Packages" to="/packages" />
          <QuickLink label="Trainers" to="/trainers" />
          <QuickLink label="Offers" to="/offers" />
        </div>
      </div>

      {/* CONTENT */}
      {activeTab === TABS.ATTENDANCE_CONFIG && <AttendanceConfigView />}
    </div>
  );
}

/* ======================================================
   ATTENDANCE CONFIG VIEW (SETTINGS + REPORTS)
====================================================== */
function AttendanceConfigView() {
  const { showToast } = useToast();
  const [limits, setLimits] = useState({ member: 1, trainer: 1, referral: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exceedReport, setExceedReport] = useState([]);

  useEffect(() => {
    loadSettingsAndReport();
  }, []);

  const loadSettingsAndReport = async () => {
    setLoading(true);
    try {
      // 1. Load Settings
      const { data: settingsData } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["member_punch_limit", "trainer_punch_limit", "referral_reward_amount"]);

      const newLimits = { member: 1, trainer: 1, referral: 0 };
      settingsData?.forEach(s => {
        if (s.key === "member_punch_limit") newLimits.member = parseInt(s.value) || 1;
        if (s.key === "trainer_punch_limit") newLimits.trainer = parseInt(s.value) || 1;
        if (s.key === "referral_reward_amount") newLimits.referral = parseInt(s.value) || 0;
      });
      setLimits(newLimits);

      // 2. Load Exceed Report (Simplified demo logic: actually needs a Group By query)
      // For now, we'll fetch attendance and manually check (since Supabase GROUP BY is tricky in simple JS client)

      const [memberAttRes, trainerAttRes, membersRes, trainersRes] = await Promise.all([
        supabase.from("member_attendance").select("member_id, date"),
        supabase.from("trainer_attendance").select("trainer_id, date"),
        supabase.from("members").select("id, full_name"),
        supabase.from("trainers").select("id, full_name")
      ]);

      const memberMap = new Map((membersRes.data || []).map(m => [m.id, m.full_name]));
      const trainerMap = new Map((trainersRes.data || []).map(t => [t.id, t.full_name]));

      const report = [];

      // Check members
      const memberCounts = {};
      (memberAttRes.data || []).forEach(a => {
        const k = `${a.member_id}_${a.date}`;
        memberCounts[k] = (memberCounts[k] || 0) + 1;
      });

      Object.entries(memberCounts).forEach(([k, count]) => {
        if (count > newLimits.member) {
          const [id, date] = k.split('_');
          report.push({
            name: memberMap.get(id) || `Member #${id}`,
            type: "Member",
            date,
            count
          });
        }
      });

      // Check trainers
      const trainerCounts = {};
      (trainerAttRes.data || []).forEach(a => {
        const k = `${a.trainer_id}_${a.date}`;
        trainerCounts[k] = (trainerCounts[k] || 0) + 1;
      });

      Object.entries(trainerCounts).forEach(([k, count]) => {
        if (count > newLimits.trainer) {
          const [id, date] = k.split('_');
          report.push({
            name: trainerMap.get(id) || `Trainer #${id}`,
            type: "Trainer",
            date,
            count
          });
        }
      });

      setExceedReport(report.sort((a, b) => b.date.localeCompare(a.date)));

    } catch (err) {
      console.error("Failed to load attendance config", err);
    } finally {
      setLoading(false);
    }
  };

  const saveLimits = async () => {
    setSaving(true);
    try {
      const { error: err1 } = await supabase
        .from("system_settings")
        .upsert({ key: "member_punch_limit", value: String(limits.member), updated_at: new Date() });

      const { error: err2 } = await supabase
        .from("system_settings")
        .upsert({ key: "trainer_punch_limit", value: String(limits.trainer), updated_at: new Date() });

      const { error: err3 } = await supabase
        .from("system_settings")
        .upsert({ key: "referral_reward_amount", value: String(limits.referral), updated_at: new Date() });

      if (err1 || err2 || err3) throw err1 || err2 || err3;

      // Retroactively update all unapplied referrals with the new reward amount
      const { error: refErr } = await supabase
        .from("referrals")
        .update({ reward_amount: limits.referral })
        .eq("reward_applied", false);

      if (refErr) {
        console.error("Failed to update unapplied referrals", refErr);
        // We don't throw here to avoid blocking the main settings save
      }

      showToast("Settings saved successfully", "success");
      loadSettingsAndReport(); // Refresh report with new limits
    } catch (err) {
      console.error(err);
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-secondary">Loading attendance config…</div>;

  return (
    <div className="space-y-8">
      {/* LIMIT SETTINGS */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">Daily Punching Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Member Daily Limit
            </label>
            <input
              type="number"
              min="1"
              value={limits.member}
              onChange={(e) => setLimits(prev => ({ ...prev, member: parseInt(e.target.value) || 0 }))}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-secondary mt-1">Maximum allowed punches per day for a member.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Trainer Daily Limit
            </label>
            <input
              type="number"
              min="1"
              value={limits.trainer}
              onChange={(e) => setLimits(prev => ({ ...prev, trainer: parseInt(e.target.value) || 0 }))}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-secondary mt-1">Maximum allowed punches per day for a trainer.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Referral Reward Amount (₹)
            </label>
            <input
              type="text"
              min="0"
              value={limits.referral}
              onChange={(e) => setLimits(prev => ({ ...prev, referral: parseInt(e.target.value) || 0 }))}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-secondary mt-1">Reward amount given to a member for each referral.</p>
          </div>
        </div>
        <button
          onClick={saveLimits}
          disabled={saving}
          className="mt-6 px-6 h-10 bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {/* EXCEED REPORT */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">Punching Limit Exceed Report</h2>
          <p className="text-sm text-secondary mt-1">
            Showing all instances where members or trainers exceeded their daily limits.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-secondary">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Type</th>
                <th className="px-6 py-3 text-left font-semibold">Date</th>
                <th className="px-6 py-3 text-left font-semibold text-center">Punch Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exceedReport.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-secondary italic">
                    No limit violations found.
                  </td>
                </tr>
              ) : (
                exceedReport.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/20/50">
                    <td className="px-6 py-4 font-semibold text-white">{r.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${r.type === "Member" ? "badge-info" : "bg-purple-50 text-purple-700"
                        }`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-secondary">{r.date}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">
                        {r.count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



function QuickLink({ label, to }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="
        border rounded-lg p-4 text-left
        hover:border-primary hover:bg-primary/5
        transition
      "
    >
      <div className="text-sm font-semibold text-white">
        {label}
      </div>
      <div className="text-xs text-secondary mt-1">
        View {label.toLowerCase()}
      </div>
    </button>
  );
}
