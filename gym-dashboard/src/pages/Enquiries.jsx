import { useModal } from "../context/ModalContext";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import AddEnquiryModal from "../modals/AddEnquiryModal";
import { useDashboard } from "../context/DashboardContext";

const Enquiries = () => {
  const { openModal } = useModal();
  const { refreshDashboard } = useDashboard();

  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  /* =========================
     LOAD ENQUIRIES
  ========================= */
  const loadEnquiries = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;
      setEnquiries(data || []);
    } catch (err) {
      console.error("Failed to load enquiries:", err);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, []);

  /* =========================
     FILTERED DATA
  ========================= */
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      const name = (e.full_name || "").toLowerCase();
      const phone = (e.phone || "").toLowerCase();
      const status = (e.status || "").toLowerCase();

      const matchesSearch =
        search.trim() === "" ||
        name.includes(search.toLowerCase()) ||
        phone.includes(search.toLowerCase());

      const matchesSource =
        sourceFilter === "All" || e.source === sourceFilter;

      const matchesStatus =
        statusFilter === "All" ||
        status === statusFilter.toLowerCase();

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [enquiries, search, sourceFilter, statusFilter]);

  /* =========================
     CONVERT → CREATE MEMBER
  ========================= */
  const convertToMember = async (enquiryId) => {
    const enquiry = enquiries.find((e) => e.id === enquiryId);
    if (!enquiry) return;

    const ok = window.confirm(
      `Convert ${enquiry.full_name || "this enquiry"} to a member?`
    );
    if (!ok) return;

    try {
      const payload = {
        full_name: enquiry.full_name || null,
        phone: enquiry.phone || null,
        area: enquiry.area || null,
        gender: enquiry.gender || null,
        source: "enquiry",
        status: "New",
        is_active: true,
        is_deleted: false,
        deleted_at: null,
        joining_date: new Date().toISOString().slice(0, 10),
      };

      const { data: member, error: memberError } = await supabase
        .from("members")
        .insert(payload)
        .select("id")
        .single();

      if (memberError) throw memberError;

      const { error: enquiryError } = await supabase
        .from("enquiries")
        .update({ status: "Converted" })
        .eq("id", enquiryId);

      if (enquiryError) throw enquiryError;

      await loadEnquiries();
      await refreshDashboard();
    } catch (err) {
      console.error("Failed to convert enquiry:", err);
      alert("Failed to convert enquiry. Please check required fields.");
    }
  };

  /* =========================
     DELETE ENQUIRY
  ========================= */
  const deleteEnquiry = async (enquiryId) => {
    const ok = window.confirm("Delete this enquiry permanently?");
    if (!ok) return;

    const { error } = await supabase
      .from("enquiries")
      .delete()
      .eq("id", enquiryId);

    if (error) {
      console.error("Failed to delete enquiry:", error);
      alert("Failed to delete enquiry");
      return;
    }

    setEnquiries((prev) => prev.filter((e) => e.id !== enquiryId));
    await refreshDashboard();
  };

  /* =========================
     UI HELPERS
  ========================= */
  const statusClass = (statusRaw) => {
    const status = (statusRaw || "").toLowerCase();
    if (status === "converted") return "bg-green-100 text-green-700";
    if (status === "hot") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-secondary";
  };

  const sourceClass = (source) => {
    switch ((source || "").toLowerCase()) {
      case "facebook":
        return "bg-blue-50 text-blue-600";
      case "instagram":
        return "bg-pink-50 text-pink-600";
      case "referral":
        return "bg-purple-50 text-purple-600";
      case "walk-in":
        return "bg-gray-100 text-secondary";
      default:
        return "bg-gray-100 text-secondary";
    }
  };

  return (
    <main className="flex-1 bg-navy">
      <div className="mx-auto w-full px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">Enquiries</h1>

          <button
            onClick={() =>
              openModal(
                <AddEnquiryModal
                  onSaved={async () => {
                    await loadEnquiries();
                    await refreshDashboard();
                  }}
                />
              )
            }
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold"
          >
            + Add Enquiry
          </button>
        </div>

        {/* ================= MOBILE VIEW ================= */}
        <div className="md:hidden space-y-3">
          {!loading &&
            filteredEnquiries.map((e) => {
              const isConverted =
                (e.status || "").toLowerCase() === "converted";

              return (
                <div
                  key={e.id}
                  className="bg-card border rounded-lg p-3 flex justify-between items-center gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm">{e.full_name}</div>
                    <div className="text-xs text-secondary">{e.phone}</div>

                    <div className="flex gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass(
                          e.status
                        )}`}
                      >
                        {e.status}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sourceClass(
                          e.source
                        )}`}
                      >
                        {e.source}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isConverted ? (
                      <span className="text-xs font-semibold text-gray-400">
                        Converted
                      </span>
                    ) : (
                      <button
                        onClick={() => convertToMember(e.id)}
                        className="text-sm font-semibold text-primary"
                      >
                        Convert
                      </button>
                    )}
                    <button
                      onClick={() => deleteEnquiry(e.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>

        {/* ================= DESKTOP TABLE ================= */}
        <div className="hidden md:block bg-card border rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-secondary">
                <tr>
                  <th className="px-5 py-3 text-left">ID</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Phone</th>
                  <th className="px-5 py-3 text-left">Source</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  filteredEnquiries.map((e) => {
                    const isConverted =
                      (e.status || "").toLowerCase() === "converted";

                    return (
                      <tr key={e.id} className="border-t hover:bg-slate-800/50">
                        <td className="px-5 py-3 text-gray-400">#{e.id}</td>
                        <td className="px-5 py-3 font-medium">{e.full_name}</td>
                        <td className="px-5 py-3 text-secondary">{e.phone}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${sourceClass(
                              e.source
                            )}`}
                          >
                            {e.source}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass(
                              e.status
                            )}`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {isConverted ? (
                              <span className="text-gray-400 text-sm">
                                Converted
                              </span>
                            ) : (
                              <button
                                onClick={() => convertToMember(e.id)}
                                className="text-primary text-sm font-semibold"
                              >
                                Convert
                              </button>
                            )}
                            <button
                              onClick={() => deleteEnquiry(e.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && filteredEnquiries.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-6 text-center text-secondary"
                    >
                      No enquiries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
};

export default Enquiries;
