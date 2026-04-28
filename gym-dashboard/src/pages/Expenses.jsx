import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import ExpenseSubtypeModal from "../modals/ExpenseSubtypeModal";
import ExpenseTypeModal from "../modals/ExpenseTypeModal";

const EXPENSE_TYPES = [
  "Utilities",
  "Rent",
  "Maintenance",
  "Salary",
  "Supplies",
  "Other",
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer"];

const toDateOnly = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export default function Expenses() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [subtypes, setSubtypes] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState(EXPENSE_TYPES);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subtypesLoading, setSubtypesLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSubtypeModal, setShowSubtypeModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [proofFile, setProofFile] = useState(null);

  const [form, setForm] = useState({
    expense_type: EXPENSE_TYPES[0],
    expense_subtype_id: "",
    amount: "",
    payment_mode: PAYMENT_MODES[0],
    expense_at: "",
    remark: "",
  });

  const [filters, setFilters] = useState({
    search: "",
    type: "",
    subtype: "",
    mode: "",
    from: "",
    to: "",
  });

  const loadExpenseTypes = async () => {
    setTypesLoading(true);
    const { data, error: loadError } = await supabase
      .from("expense_types")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name");

    if (loadError) {
      setExpenseTypes(EXPENSE_TYPES);
    } else {
      const names = (data || [])
        .map((t) => t?.name)
        .filter(Boolean);
      setExpenseTypes(names.length ? names : EXPENSE_TYPES);
    }
    setTypesLoading(false);
  };

  const loadSubtypes = async (type) => {
    setSubtypesLoading(true);
    const { data, error: loadError } = await supabase
      .from("expense_subtypes")
      .select("id, name, type, is_active")
      .eq("type", type)
      .eq("is_active", true)
      .order("name");

    if (loadError) {
      setSubtypes([]);
    } else {
      setSubtypes(data || []);
    }
    setSubtypesLoading(false);
  };

  const loadExpenses = async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("expenses")
      .select(
        `
        id,
        expense_type,
        expense_subtype_id,
        amount,
        payment_mode,
        payment_proof_url,
        expense_at,
        remark,
        expense_subtypes ( name )
      `
      )
      .order("expense_at", { ascending: false });

    if (filters.type) {
      query = query.eq("expense_type", filters.type);
    }
    if (filters.subtype) {
      query = query.eq("expense_subtype_id", filters.subtype);
    }
    if (filters.mode) {
      query = query.eq("payment_mode", filters.mode);
    }
    if (filters.from) {
      query = query.gte("expense_at", `${filters.from}T00:00:00`);
    }
    if (filters.to) {
      query = query.lte("expense_at", `${filters.to}T23:59:59`);
    }

    const { data, error: loadError } = await query;
    if (loadError) {
      setError(loadError.message);
      setExpenses([]);
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      setAuthChecked(true);
    };

    init();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadExpenseTypes();
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    loadSubtypes(form.expense_type);
  }, [authChecked, form.expense_type]);

  useEffect(() => {
    if (!authChecked) return;
    loadExpenses();
  }, [authChecked, filters]);

  useEffect(() => {
    if (expenseTypes.length === 0) return;
    setForm((prev) => {
      if (expenseTypes.includes(prev.expense_type)) return prev;
      return {
        ...prev,
        expense_type: expenseTypes[0],
        expense_subtype_id: "",
      };
    });
  }, [expenseTypes]);

  const filteredExpenses = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((e) => {
      const subtypeName = e.expense_subtypes?.name || "";
      return (
        e.expense_type?.toLowerCase().includes(term) ||
        e.payment_mode?.toLowerCase().includes(term) ||
        subtypeName.toLowerCase().includes(term) ||
        (e.remark || "").toLowerCase().includes(term)
      );
    });
  }, [expenses, filters.search]);

  const resetForm = () => {
    const nextType = expenseTypes[0] || EXPENSE_TYPES[0];
    setForm({
      expense_type: nextType,
      expense_subtype_id: "",
      amount: "",
      payment_mode: PAYMENT_MODES[0],
      expense_at: "",
      remark: "",
    });
    setProofFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.expense_subtype_id) {
      setError("Please select an expense subtype.");
      return;
    }

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!form.expense_at) {
      setError("Please select date & time.");
      return;
    }

    let proofUrl = null;
    if (proofFile) {
      const ext = proofFile.name.split(".").pop();
      const fileName = `expense-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("expense-proofs")
        .upload(fileName, proofFile, { upsert: true });

      if (uploadError) {
        setError(uploadError.message || "Failed to upload proof.");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("expense-proofs")
        .getPublicUrl(fileName);

      proofUrl = urlData?.publicUrl || null;
    }

    const { error: insertError } = await supabase
      .from("expenses")
      .insert({
        expense_type: form.expense_type,
        expense_subtype_id: form.expense_subtype_id,
        amount,
        payment_mode: form.payment_mode,
        payment_proof_url: proofUrl,
        expense_at: form.expense_at,
        remark: form.remark || null,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    resetForm();
    loadExpenses();
  };

  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto w-full p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Expenses</h1>
          <p className="text-secondary">Track utilities and operational expenses.</p>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Add Expense</h2>

          {error && (
            <div className="mb-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-secondary">Type</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="w-full border rounded-lg px-3 py-2 sm:flex-1 min-w-0 bg-card text-white"
                    value={form.expense_type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expense_type: e.target.value,
                        expense_subtype_id: "",
                      }))
                    }
                  >
                    {expenseTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowTypeModal(true)}
                    className="px-3 py-2 border rounded-lg text-sm font-semibold text-primary whitespace-nowrap w-full sm:w-auto shrink-0"
                  >
                    Manage
                  </button>
                </div>
                {typesLoading && (
                  <div className="text-xs text-gray-400 mt-1">Loading typesâ€¦</div>
                )}
              </div>

              <div>
                <label className="text-sm text-secondary">Subtype</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="w-full border rounded-lg px-3 py-2 sm:flex-1 min-w-0 bg-card text-white"
                    value={form.expense_subtype_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expense_subtype_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select subtype</option>
                    {subtypes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSubtypeModal(true)}
                    className="px-3 py-2 border rounded-lg text-sm font-semibold text-primary whitespace-nowrap w-full sm:w-auto shrink-0"
                  >
                    Manage
                  </button>
                </div>
                {subtypesLoading && (
                  <div className="text-xs text-gray-400 mt-1">Loading subtypes…</div>
                )}
              </div>

              <div>
                <label className="text-sm text-secondary">Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-secondary">Payment Mode</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                  value={form.payment_mode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      payment_mode: e.target.value,
                    }))
                  }
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-secondary">Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                  value={form.expense_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expense_at: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-secondary">Payment Proof</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-secondary">Remark</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 bg-card text-white"
                rows="3"
                value={form.remark}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remark: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-primary text-white font-semibold"
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>

        {/* FILTER BAR */}
        <div className="bg-card border rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search remarks or subtype..."
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] bg-card text-white"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
          />

          <select
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto min-w-[160px] bg-card text-white"
            value={filters.type}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                type: e.target.value,
                subtype: "",
              }))
            }
          >
            <option value="">All Types</option>
            {expenseTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto min-w-[200px] bg-card text-white"
            value={filters.subtype}
            onChange={(e) =>
              setFilters((f) => ({ ...f, subtype: e.target.value }))
            }
          >
            <option value="">All Subtypes</option>
            {subtypes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto min-w-[160px] bg-card text-white"
            value={filters.mode}
            onChange={(e) =>
              setFilters((f) => ({ ...f, mode: e.target.value }))
            }
          >
            <option value="">All Modes</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto bg-card text-white"
            value={filters.from}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value }))
            }
          />

          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto bg-card text-white"
            value={filters.to}
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value }))
            }
          />

          <button
            onClick={() =>
              setFilters({
                search: "",
                type: "",
                subtype: "",
                mode: "",
                from: "",
                to: "",
              })
            }
            className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-semibold"
          >
            Clear
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-800/50 text-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Subtype</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Payment Mode</th>
                  <th className="px-4 py-3 text-left">Proof</th>
                  <th className="px-4 py-3 text-left">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center text-secondary">
                      Loading expenses...
                    </td>
                  </tr>
                )}
                {!loading && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center text-secondary">
                      No expenses found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredExpenses.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">
                        {e.expense_at
                          ? new Date(e.expense_at).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{e.expense_type}</td>
                      <td className="px-4 py-3">{e.expense_subtypes?.name || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        ₹{Number(e.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">{e.payment_mode || "—"}</td>
                      <td className="px-4 py-3">
                        {e.payment_proof_url ? (
                          <a
                            href={e.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">{e.remark || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden">
            {loading && (
              <div className="px-4 py-6 text-center text-secondary">
                Loading expenses...
              </div>
            )}
            {!loading && filteredExpenses.length === 0 && (
              <div className="px-4 py-6 text-center text-secondary">
                No expenses found.
              </div>
            )}
            {!loading &&
              filteredExpenses.map((e) => (
                <div key={e.id} className="border-b p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-white">{e.expense_type}</div>
                      <div className="text-sm text-secondary">{e.expense_subtypes?.name || "—"}</div>
                    </div>
                    <div className="font-semibold text-white">
                      ₹{Number(e.amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-secondary">
                    {e.remark || "—"}
                  </div>
                  <div className="mt-3 flex justify-between items-center text-xs text-secondary">
                    <div>
                      {e.expense_at
                        ? new Date(e.expense_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                    <div>
                      {e.payment_mode || "—"}
                      {e.payment_proof_url && (
                        <a
                          href={e.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline ml-2"
                        >
                          View Proof
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <ExpenseSubtypeModal
        open={showSubtypeModal}
        onClose={() => setShowSubtypeModal(false)}
        expenseType={form.expense_type}
        onUpdated={() => loadSubtypes(form.expense_type)}
      />
      <ExpenseTypeModal
        open={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        onUpdated={loadExpenseTypes}
      />
    </div>
  );
}
