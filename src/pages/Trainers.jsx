import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import ActionButtons from "../components/ActionButtons";

import { useToast } from "../context/ToastContext";

export default function Trainers() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  /* ===============================
     AUTH GUARD
  =============================== */
  const requireSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      navigate("/login");
      throw new Error("Not authenticated");
    }

    return session;
  };

  /* ===============================
     FETCH TRAINERS (FIXED)
  =============================== */
  const fetchTrainers = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("trainers")
        .select(
          `
          id,
          full_name,
          phone,
          email,
          specialization,
          profile_image_url
        `
        )
        .order("full_name", { ascending: true });

      if (error) throw error;
      setTrainers(data || []);
    } catch (err) {
      console.error("Failed to load trainers:", err);
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  /* ===============================
     DELETE TRAINER
  =============================== */
  const deleteTrainer = async (trainer) => {
    if (!trainer?.id) return;

    const confirmed = window.confirm(
      `Delete trainer "${trainer.full_name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await requireSession();

      const { data: assignedMembers, error } = await supabase
        .from("members")
        .select("id, full_name")
        .eq("trainer_id", trainer.id);

      if (error) {
        console.error(error);
        alert("Failed to check trainer assignments");
        return;
      }

      if ((assignedMembers || []).length > 0) {
        const names = assignedMembers
          .map((m) => m.full_name)
          .slice(0, 5)
          .join(", ");

        const extra =
          assignedMembers.length > 5
            ? ` and ${assignedMembers.length - 5} more`
            : "";

        alert(
          `Cannot delete trainer.\n\n` +
            `This trainer is assigned to ${assignedMembers.length} member(s):\n` +
            `${names}${extra}\n\n` +
            `Please reassign these members before deleting.`
        );

        return;
      }

      const { error: deleteError } = await supabase
        .from("trainers")
        .delete()
        .eq("id", trainer.id);

      if (deleteError) {
        console.error(deleteError);
        alert("Failed to delete trainer");
        return;
      }
      showToast("Trainer deleted successfully", "success");
      fetchTrainers();
    } catch (err) {
      console.error("Failed to delete trainer:", err);
      showToast("Failed to delete trainer", "error");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 bg-navy">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Trainers</h1>
          <p className="text-secondary">Manage gym trainers and staff.</p>
        </div>

        <button
          onClick={() => navigate("/add-trainer")}
          className="h-10 px-4 rounded-lg bg-primary text-white font-semibold"
        >
          + Add Trainer
        </button>
      </div>

      {/* ================= MOBILE VIEW ================= */}
      <div className="md:hidden space-y-3">
        {loading && (
          <p className="text-center text-sm text-secondary">
            Loading trainers…
          </p>
        )}

        {!loading &&
          trainers.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/trainers/${t.id}`)}
              className="bg-card border rounded-lg px-3 py-3 flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center font-semibold text-sm">
                  {t.profile_image_url ? (
                    <img
                      src={t.profile_image_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    t.full_name?.charAt(0) || "?"
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold">{t.full_name}</div>
                  <div className="text-xs text-secondary">{t.email || "—"}</div>
                  {Array.isArray(t.specialization) && t.specialization.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.specialization.map((spec, index) => (
                        <span key={`${t.id}-${spec}-${index}`} className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()}>
                <ActionButtons
                  size="sm"
                  viewTo={`/trainers/${t.id}`}
                  onEdit={() => navigate(`/trainers/${t.id}/edit`)}
                  onDelete={() => deleteTrainer(t)}
                />
              </div>
            </div>
          ))}
      </div>

      {/* ================= DESKTOP TABLE ================= */}
      <div className="hidden md:block bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-secondary">
            <tr>
              <th className="px-5 py-3 text-left">Trainer</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">Specialization</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-secondary">
                  Loading trainers…
                </td>
              </tr>
            )}

            {!loading && trainers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-secondary">
                  No trainers found.
                </td>
              </tr>
            )}

            {!loading &&
              trainers.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/trainers/${t.id}`)}
                  className="border-t hover:bg-slate-800/50 cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center font-semibold text-sm">
                        {t.profile_image_url ? (
                          <img
                            src={t.profile_image_url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          t.full_name?.charAt(0) || "?"
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{t.full_name}</div>
                        <div className="text-xs text-secondary">
                          {t.email || "—"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3 text-white">
                    {t.phone || "—"}
                  </td>

                  <td className="px-5 py-3">
                    {Array.isArray(t.specialization) && t.specialization.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.specialization.map((spec, index) => (
                          <span key={`${t.id}-${spec}-${index}`} className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                            {spec}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionButtons
                        onEdit={() => navigate(`/trainers/${t.id}/edit`)}
                        onDelete={() => deleteTrainer(t)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
