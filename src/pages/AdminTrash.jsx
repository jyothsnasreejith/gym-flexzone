import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useToast } from "../context/ToastContext";

export default function AdminTrash() {
  const { showToast } = useToast();
  const [deletedMembers, setDeletedMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD DELETED MEMBERS ================= */
  const loadDeletedMembers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("members")
      .select(
        `
        id,
        full_name,
        admission_no,
        deleted_at,
        phone
      `
      )
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error("Failed to load deleted members:", error);
      showToast("Failed to load trash", "error");
      setDeletedMembers([]);
    } else {
      setDeletedMembers(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDeletedMembers();
  }, []);

  /* ================= RESTORE MEMBER ================= */
  const restoreMember = async (id) => {
    if (!window.confirm("Restore this member?")) return;

    const { error } = await supabase
      .from("members")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("id", id);

    if (error) {
      console.error("Restore failed:", error);
      showToast("Restore failed", "error");
      return;
    }

    showToast("Member restored successfully", "success");

    setDeletedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  /* ================= PERMANENT DELETE ================= */
  const deleteMemberPermanently = async (id) => {
    if (!window.confirm("Permanently delete this member? This cannot be undone.")) {
      return;
    }

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Permanent delete failed:", error);
      showToast("Permanent delete failed", "error");
      return;
    }

    showToast("Member permanently deleted", "success");
    setDeletedMembers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-6 bg-navy">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deleted Members (Trash)</h1>
        <p className="text-sm text-secondary">
          Restore previously deleted members.
        </p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-secondary">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">
                  Admission No
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Member Name
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Phone
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Deleted On
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {!loading &&
                deletedMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/50">
                    <td className="px-5 py-4 font-mono text-xs">
                      {m.admission_no || "—"}
                    </td>

                    <td className="px-5 py-4 font-medium">
                      {m.full_name}
                    </td>

                    <td className="px-5 py-4">
                      {m.phone || "—"}
                    </td>

                    <td className="px-5 py-4 text-secondary">
                      {m.deleted_at
                        ? new Date(m.deleted_at).toLocaleString("en-IN")
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreMember(m.id)}
                          className="px-3 py-1.5 rounded-lg badge-success text-xs font-semibold hover:bg-green-100"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => deleteMemberPermanently(m.id)}
                          className="px-3 py-1.5 rounded-lg badge-error text-xs font-semibold hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {deletedMembers.map((m) => (
            <div key={m.id} className="border-b p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{m.full_name}</div>
                  <div className="text-xs font-mono text-secondary">
                    {m.admission_no || "—"}
                  </div>
                </div>
                <div className="text-sm text-secondary">
                  {m.phone || "—"}
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <div className="text-xs text-secondary">
                  Deleted:{" "}
                  {m.deleted_at
                    ? new Date(m.deleted_at).toLocaleString("en-IN")
                    : "—"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => restoreMember(m.id)}
                    className="px-3 py-1.5 rounded-lg badge-success text-xs font-semibold hover:bg-green-100"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => deleteMemberPermanently(m.id)}
                    className="px-3 py-1.5 rounded-lg badge-error text-xs font-semibold hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <p className="text-center py-8 text-secondary">
            Loading deleted members...
          </p>
        )}

        {!loading && deletedMembers.length === 0 && (
          <p className="text-center py-8 text-secondary">
            Trash is empty.
          </p>
        )}
      </div>
    </div>
  );
}
