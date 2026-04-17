import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PageHeader from "../components/PageHeader";

export default function TrainerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trainer, setTrainer] = useState(null);
  const [members, setMembers] = useState([]);
  const [allTrainers, setAllTrainers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberTargets, setMemberTargets] = useState({});
  const [updatingAssignments, setUpdatingAssignments] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadTrainerAndMembers = async () => {
      setLoading(true);

      try {
        const { data: trainerData, error: trainerError } =
          await supabase
            .from("trainers")
            .select(`
              id,
              full_name,
              phone,
              email,
              specialization,
              designation,
              date_of_joining,
              base_salary,
              commission,
              shift,
              weekly_off,
              notes,
              profile_image_url
            `)
            .eq("id", id)
            .single();

        if (trainerError) throw trainerError;
        setTrainer(trainerData);

        const { data: membersData, error: membersError } =
          await supabase
            .from("members")
            .select("id, full_name, phone, email")
            .eq("trainer_id", id)
            .eq("is_deleted", false)
            .order("full_name", { ascending: true });

        if (membersError) throw membersError;
        setMembers(membersData || []);

        const { data: trainersData, error: trainersError } =
          await supabase
            .from("trainers")
            .select("id, full_name")
            .order("full_name", { ascending: true });

        if (trainersError) throw trainersError;
        setAllTrainers((trainersData || []).filter((t) => String(t.id) !== String(id)));
      } catch (err) {
        console.error(err);
        setTrainer(null);
        setMembers([]);
        setAllTrainers([]);
      } finally {
        setLoading(false);
      }
    };

    loadTrainerAndMembers();
  }, [id]);

  if (loading) return <div className="p-4">Loading trainer…</div>;
  if (!trainer) return <div className="p-4">Trainer not found.</div>;

  const toggleSelectAll = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map((m) => m.id));
    }
  };

  const toggleSelectMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const updateAssignments = async () => {
    if (selectedMemberIds.length === 0) return;
    setUpdatingAssignments(true);

    try {
      const updates = selectedMemberIds
        .map((memberId) => ({
          memberId,
          trainerId: memberTargets[memberId],
        }))
        .filter((u) => u.trainerId);

      if (updates.length === 0) {
        setUpdatingAssignments(false);
        return;
      }

      for (const u of updates) {
        const { error } = await supabase
          .from("members")
          .update({ trainer_id: u.trainerId })
          .eq("id", u.memberId);

        if (error) throw error;
      }

      const { data: membersData, error: membersError } =
        await supabase
          .from("members")
          .select("id, full_name, phone, email")
          .eq("trainer_id", id)
          .order("full_name", { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);
      setSelectedMemberIds([]);
      setMemberTargets({});
    } catch (err) {
      console.error("Failed to update assignments:", err);
      alert("Failed to update trainer assignments");
    } finally {
      setUpdatingAssignments(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-8 space-y-6">
      <PageHeader title="Trainer Details" backTo="/trainers" />

      {/* HEADER */}
      <section className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-lg bg-blue-50 border overflow-hidden flex items-center justify-center font-bold text-blue-600">
              {trainer.profile_image_url ? (
                <img
                  src={trainer.profile_image_url}
                  className="w-full h-full object-cover"
                  alt={trainer.full_name}
                />
              ) : (
                trainer.full_name?.charAt(0) || "?"
              )}
            </div>


            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold">
                  {trainer.full_name}
                </h1>
                {trainer.specialization && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                    {trainer.specialization}
                  </span>
                )}
              </div>

              <div className="text-sm text-secondary mt-1 space-y-1 sm:space-y-0 sm:flex sm:gap-4">
                <span>{trainer.phone || "—"}</span>
                <span>{trainer.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* EDIT BUTTON */}
          <button
            onClick={() => navigate(`/trainers/${id}/edit`)}
            className="
        h-9
        px-4
        rounded-lg
        border
        text-sm
        font-semibold
        hover:bg-slate-800/50
      "
          >
            Edit Profile
          </button>
        </div>
      </section>


      {/* EMPLOYMENT DETAILS */}
      <section className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <h3 className="font-semibold mb-4">Employment Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Detail label="Designation" value={trainer.designation} />
          <Detail label="Date of Joining" value={trainer.date_of_joining} />
          <Detail label="Shift" value={capitalize(trainer.shift)} />
          <Detail label="Weekly Off" value={trainer.weekly_off} />
          <Detail
            label="Base Salary"
            value={trainer.base_salary ? `₹${trainer.base_salary}` : null}
            highlight
          />
          <Detail
            label="Commission"
            value={trainer.commission ? `${trainer.commission}%` : null}
            highlight
          />
        </div>

        {trainer.notes && (
          <div className="mt-4 pt-4 border-t text-sm text-secondary">
            <span className="font-medium">Notes:</span> {trainer.notes}
          </div>
        )}
      </section>

      {/* ASSIGNED MEMBERS */}
      <section className="bg-card rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Assigned Members</h3>
          <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
            {members.length}
          </span>
        </div>

        {members.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedMemberIds.length === members.length}
                onChange={toggleSelectAll}
              />
              Select all
            </label>

            <button
              type="button"
              onClick={updateAssignments}
              disabled={updatingAssignments || selectedMemberIds.length === 0}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
            >
              {updatingAssignments ? "Updating..." : "Change Trainer"}
            </button>
          </div>
        )}

        {/* MOBILE LIST */}
        <div className="sm:hidden divide-y">
          {members.length === 0 ? (
            <div className="p-4 text-secondary">
              No members assigned.
            </div>
          ) : (
            members.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 flex items-center gap-4 hover:bg-slate-800/50"
              >
                <div className="w-6 text-xs text-gray-400">{idx + 1}.</div>
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(m.id)}
                  onChange={() => toggleSelectMember(m.id)}
                />
                <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                  {m.full_name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <div
                    className="font-medium cursor-pointer"
                    onClick={() => navigate(`/members/${m.id}`)}
                  >
                    {m.full_name}
                  </div>
                  <div className="text-xs text-secondary">
                    {m.phone || "—"}
                  </div>
                  <select
                    value={memberTargets[m.id] || ""}
                    onChange={(e) =>
                      setMemberTargets((prev) => ({
                        ...prev,
                        [m.id]: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="mt-2 w-full border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="">Select new trainer</option>
                    {allTrainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP TABLE */}
        <table className="hidden sm:table w-full text-sm">
          <thead className="bg-slate-800/50 text-secondary">
            <tr>
              <th className="px-6 py-3 text-left">#</th>
              <th className="px-6 py-3 text-left"></th>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Phone</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">New Trainer</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m, idx) => (
              <tr
                key={m.id}
                className="hover:bg-slate-800/50"
              >
                <td className="px-6 py-4 text-gray-400">
                  {idx + 1}
                </td>
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(m.id)}
                    onChange={() => toggleSelectMember(m.id)}
                  />
                </td>
                <td className="px-6 py-4 flex items-center gap-3 font-medium">
                  <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
                    {m.full_name?.charAt(0)}
                  </div>
                  <span
                    className="cursor-pointer"
                    onClick={() => navigate(`/members/${m.id}`)}
                  >
                    {m.full_name}
                  </span>
                </td>
                <td className="px-6 py-4">{m.phone || "—"}</td>
                <td className="px-6 py-4">{m.email || "—"}</td>
                <td className="px-6 py-4">
                  <select
                    value={memberTargets[m.id] || ""}
                    onChange={(e) =>
                      setMemberTargets((prev) => ({
                        ...prev,
                        [m.id]: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full border rounded-md px-2 py-1 text-sm"
                  >
                    <option value="">Select new trainer</option>
                    {allTrainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* HELPERS */

const Detail = ({ label, value, highlight = false }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-gray-400">
      {label}
    </div>
    <div className={`mt-1 font-semibold ${highlight ? "text-green-600" : ""}`}>
      {value || "—"}
    </div>
  </div>
);

const capitalize = (v) =>
  typeof v === "string" ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
