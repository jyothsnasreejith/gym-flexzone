import React, { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";

const MessageTemplateManager = () => {
  const { openModal, closeModal } = useModal();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openAdd = () => {
    openModal(
      <TemplateModal
        mode="add"
        onSave={() => {
          closeModal();
          loadTemplates();
        }}
      />
    );
  };

  const openEdit = (template) => {
    openModal(
      <TemplateModal
        mode="edit"
        initial={template}
        onSave={() => {
          closeModal();
          loadTemplates();
        }}
      />
    );
  };

  const deleteTemplate = async (id) => {
    try {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadTemplates();
    } catch (err) {
      alert("Failed to delete template: " + err.message);
    }
  };

  return (
    <main className="p-8 mx-auto w-full bg-navy">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">
            Message Templates
          </h1>
          <p className="text-secondary">
            Create and manage reusable communication templates.
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 h-10 bg-primary text-white rounded-lg font-semibold"
        >
          <span className="material-symbols-outlined">add</span>
          Add Template
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-slate-800/50 text-xs uppercase text-secondary">
              <tr>
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-6 py-3 text-left">Mode</th>
                <th className="px-6 py-3 text-left">Preview</th>
                <th className="px-6 py-3 text-left">Vars</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-secondary">
                    Loading templates…
                  </td>
                </tr>
              )}

              {!loading && templates.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-secondary">
                    No templates found.
                  </td>
                </tr>
              )}

              {!loading &&
                templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/50 text-sm">
                    <td className="px-6 py-4 font-medium text-white">
                      {t.title}
                    </td>

                    <td className="px-6 py-4">
                      {t.mode === "sms" ? (
                        <span className="material-symbols-outlined text-primary">
                          sms
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-green-500">
                          chat
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 max-w-xs truncate text-secondary">
                      {t.content}
                    </td>

                    <td className="px-6 py-4 text-secondary">
                      {t.variableCount ?? "—"}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-4">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-primary font-semibold"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="text-red-600 font-semibold"
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
          {loading && (
            <div className="py-6 text-center text-secondary">
              Loading templates…
            </div>
          )}
          {!loading && templates.length === 0 && (
            <div className="py-6 text-center text-secondary">
              No templates found.
            </div>
          )}
          {!loading &&
            templates.map((t) => (
              <div key={t.id} className="bg-card border rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-white">{t.title}</div>
                  {t.mode === "sms" ? (
                    <span className="material-symbols-outlined text-primary">
                      sms
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-green-500">
                      chat
                    </span>
                  )}
                </div>
                <p className="text-sm text-secondary mt-2 truncate">{t.content}</p>
                <div className="flex justify-between items-center mt-4">
                  <div className="text-xs text-secondary">
                    Vars: {t.variableCount ?? "—"}
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => openEdit(t)}
                      className="text-primary font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="text-red-600 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
};

export default MessageTemplateManager;

/* ============================================================
   TEMPLATE MODAL
============================================================ */
const TemplateModal = ({ mode, initial = {}, onSave }) => {
  const { closeModal } = useModal();

  const [title, setTitle] = useState(initial.title || "");
  const [templateMode, setTemplateMode] = useState(initial.mode || "sms");
  const [content, setContent] = useState(initial.content || "");
  const [subject, setSubject] = useState(initial.subject || "");

  const variables = [
    "[MEMBER_NAME]",
    "[DUE_DATE]",
    "[PACKAGE_NAME]",
    "[LINK]",
    "[STAFF_NAME]",
    "[BIRTHDAY_DATE]",
    "[AMOUNT_DUE]",
    "[EXPIRY_DATE]",
  ];

  const save = async () => {
    try {
      const payload = { title, mode: templateMode, content, subject: templateMode === "email" ? subject : null };

      if (mode === "add") {
        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("templates")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      }

      onSave();
    } catch (err) {
      alert("Failed to save template: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-3xl">
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">
            {mode === "add" ? "Add Template" : "Edit Template"}
          </h3>

          <button onClick={closeModal}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="p-6 space-y-6"
        >
          {/* TITLE + MODE */}
          <div className="grid md:grid-cols-2 gap-6">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Template Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="flex gap-4">
              {["sms", "whatsapp", "email"].map((m) => (
                <label
                  key={m}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${templateMode === m
                      ? "border-primary bg-primary/10"
                      : "border-gray-300"
                    }`}
                >
                  <input
                    type="radio"
                    checked={templateMode === m}
                    onChange={() => setTemplateMode(m)}
                  />
                  {m.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* EMAIL SUBJECT (only for email mode) */}
          {templateMode === "email" && (
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Email Subject *"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          )}

          {/* CONTENT + VARIABLES */}
          <div className="grid grid-cols-3 gap-6">
            <textarea
              rows="6"
              className="col-span-2 border rounded-lg p-3"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="font-semibold text-sm mb-2">Variables</p>
              <div className="space-y-2 text-xs">
                {variables.map((v) => (
                  <div
                    key={v}
                    onClick={() => setContent((c) => c + " " + v)}
                    className="cursor-pointer border rounded px-2 py-1 bg-card hover:bg-slate-800/30"
                  >
                    {v}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg font-bold"
            >
              {mode === "add" ? "Create Template" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
