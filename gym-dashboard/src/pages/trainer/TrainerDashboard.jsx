import { useEffect, useState } from "react";
import { getAuthUser, logout } from "../../utils/auth";
import { supabase } from "../../supabaseClient";

export default function TrainerDashboard() {
  const user = getAuthUser();
  const trainerId = user?.trainer_id;

  const [trainer, setTrainer] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    total_members: 0,
    today_sessions: 0,
    active_programs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hard stop if auth is broken
    if (!trainerId) {
      console.error("No trainer_id found in auth user");
      setLoading(false);
      return;
    }

    const loadDashboard = async () => {
      try {
        setLoading(true);

        // 1. Fetch trainer info
        const { data: trainerData, error: trainerError } = await supabase
          .from("trainers")
          .select("*")
          .eq("id", trainerId)
          .single();

        if (trainerError) throw trainerError;

        // 2. Fetch assigned members
        const { data: membersData, error: membersError } = await supabase
          .from("members")
          .select("id, full_name, phone, status, end_date")
          .eq("trainer_id", trainerId)
          .eq("is_deleted", false);

        if (membersError) throw membersError;

        setTrainer(trainerData);
        setMembers(membersData || []);
        setStats({
          total_members: (membersData || []).length,
          today_sessions: 0,   // Placeholder for now
          active_programs: 0,  // Placeholder for now
        });
      } catch (err) {
        console.error("Trainer dashboard load failed:", err);
        setTrainer(null);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [trainerId]);

  if (!user) {
    return (
      <div className="p-8 text-red-600">
        Not authenticated. Please log in again.
      </div>
    );
  }

  if (loading) {
    return <div className="p-8">Loading dashboard…</div>;
  }

  if (!trainer) {
    return (
      <div className="p-8 text-red-600">
        Trainer dashboard unavailable.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8 bg-navy">
      {/* =====================
          HEADER
      ===================== */}
      <div className="bg-card rounded-xl p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {trainer.full_name}
          </h1>
          <p className="text-secondary">
            {trainer.specialization || "Trainer"}
          </p>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </div>

      {/* =====================
          STATS
      ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Assigned Members"
          value={stats.total_members}
        />
        <StatCard
          label="Today’s Sessions"
          value={stats.today_sessions}
          helper="No sessions scheduled"
        />
        <StatCard
          label="Active Programs"
          value={stats.active_programs}
        />
      </div>

      {/* =====================
          MY CLIENTS
      ===================== */}
      <div className="bg-card rounded-xl border">
        <div className="px-6 py-4 border-b font-semibold">
          My Clients ({members.length})
        </div>

        {members.length === 0 ? (
          <div className="p-6 text-secondary">
            No members assigned yet.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50 text-sm text-secondary">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-4 font-medium">
                    {m.full_name}
                  </td>
                  <td className="px-6 py-4">
                    {m.phone || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                      {m.status || "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =====================
   LOCAL STAT CARD
===================== */
function StatCard({ label, value, helper }) {
  return (
    <div className="bg-card rounded-xl p-6">
      <p className="text-sm text-secondary">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {helper && (
        <p className="text-xs text-gray-400 mt-1">{helper}</p>
      )}
    </div>
  );
}
