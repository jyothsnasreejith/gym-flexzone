import { useEffect, useState } from "react";
import { useModal } from "../context/ModalContext";
import { supabase } from "../supabaseClient";
import { getFestivalsForDate, getUpcomingFestivals } from "../data/festivals";

const formatFestivalDate = (date) => {
  if (!date) return "Date not set";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getFestivalMessage = (festival) => {
  if (festival?.message) return festival.message;
  if (festival?.name) {
    return `Happy ${festival.name}! Wishing you health, happiness, and great workouts.`;
  }
  return "Wishing you health, happiness, and great workouts.";
};

const getCombinedFestivalMessage = (festivals = []) => {
  const names = festivals.map((festival) => festival?.name).filter(Boolean);
  if (names.length === 0) {
    return "Warm wishes from our gym! Wishing you health, happiness, and great workouts.";
  }
  if (names.length === 1) {
    return getFestivalMessage(festivals[0]);
  }
  if (names.length === 2) {
    return `Happy ${names[0]} & ${names[1]}! Wishing you health, happiness, and great workouts.`;
  }
  return `Happy ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}! Wishing you health, happiness, and great workouts.`;
};

const getUpcomingBadge = (daysUntil) => {
  if (daysUntil <= 0) return { label: "Today", color: "bg-green-100 text-green-700" };
  if (daysUntil === 1) return { label: "Tomorrow", color: "bg-amber-100 text-amber-700" };
  if (daysUntil <= 7) return { label: `In ${daysUntil}d`, color: "bg-orange-100 text-orange-700" };
  return { label: `In ${daysUntil}d`, color: "bg-blue-100 text-blue-700" };
};

export default function TodaysFestivalsModal({
  festivals = [],
  upcomingFestivals = [],
  onFestivalAdded,
}) {
  const { closeModal } = useModal();
  const [localFestivals, setLocalFestivals] = useState(festivals);
  const [localUpcomingFestivals, setLocalUpcomingFestivals] = useState(upcomingFestivals);
  const [festivalName, setFestivalName] = useState("");
  const [festivalDate, setFestivalDate] = useState("");
  const [festivalMessage, setFestivalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editingFestivalId, setEditingFestivalId] = useState(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [isSavingMessage, setIsSavingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");

  useEffect(() => {
    setLocalFestivals(festivals);
    setLocalUpcomingFestivals(upcomingFestivals);
  }, [festivals, upcomingFestivals]);

  const sendWhatsAppWish = (festival) => {
    const message = encodeURIComponent(getFestivalMessage(festival));
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const sendGreetingsToAll = () => {
    if (localFestivals.length === 0) return;
    const message = encodeURIComponent(getCombinedFestivalMessage(localFestivals));
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const refreshFestivals = async () => {
    const { data, error } = await supabase
      .from("festivals")
      .select("id, name, festival_date, message, is_active")
      .eq("is_active", true);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const today = new Date();
    setLocalFestivals(getFestivalsForDate(rows, today));
    setLocalUpcomingFestivals(getUpcomingFestivals(rows, today, 30, false));
  };

  const startEditingFestival = (festival) => {
    setEditingFestivalId(festival.id);
    setEditingMessage(festival.message || "");
    setMessageError("");
  };

  const cancelEditingFestival = () => {
    setEditingFestivalId(null);
    setEditingMessage("");
    setMessageError("");
  };

  const handleSaveMessage = async (festivalId) => {
    if (!festivalId) {
      setMessageError("Missing festival id.");
      return;
    }

    try {
      setIsSavingMessage(true);
      setMessageError("");
      const { error } = await supabase
        .from("festivals")
        .update({ message: editingMessage.trim() })
        .eq("id", festivalId);

      if (error) throw error;

      await refreshFestivals();
      cancelEditingFestival();
    } catch (err) {
      console.error("Failed to update festival message:", err);
      setMessageError("Failed to update message. Please try again.");
    } finally {
      setIsSavingMessage(false);
    }
  };

  const handleAddFestival = async (event) => {
    event.preventDefault();
    if (!festivalName.trim() || !festivalDate) {
      setSubmitError("Please provide both festival name and date.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      const { error } = await supabase
        .from("festivals")
        .insert([
          {
            name: festivalName.trim(),
            festival_date: festivalDate,
            message: festivalMessage.trim(),
            is_active: true,
          },
        ]);

      if (error) throw error;

      setFestivalName("");
      setFestivalDate("");
      setFestivalMessage("");
      await refreshFestivals();
      if (typeof onFestivalAdded === "function") {
        await onFestivalAdded();
      }
    } catch (err) {
      console.error("Failed to add festival:", err);
      setSubmitError("Failed to add festival. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600">celebration</span>
              Today's Festivals
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {localFestivals.length} festival{localFestivals.length !== 1 ? "s" : ""} today
              {localUpcomingFestivals.length > 0
                ? ` · ${localUpcomingFestivals.length} upcoming`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sendGreetingsToAll}
              disabled={localFestivals.length === 0}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                localFestivals.length === 0
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              title={localFestivals.length === 0 ? "No festivals today" : "Send greetings to everyone"}
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              Send Greetings
            </button>
            <button
              onClick={closeModal}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined text-[28px]">close</span>
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 py-4 overflow-y-auto">
          <div className="mb-6 rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Add Festival</h3>
              <span className="text-xs text-gray-500">Saved festivals show below</span>
            </div>
            <form onSubmit={handleAddFestival} className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-gray-500">Festival Name</label>
                <input
                  value={festivalName}
                  onChange={(event) => setFestivalName(event.target.value)}
                  type="text"
                  placeholder="e.g. Diwali"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs text-gray-500">Festival Date</label>
                <input
                  value={festivalDate}
                  onChange={(event) => setFestivalDate(event.target.value)}
                  type="date"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs text-gray-500">Message (Optional)</label>
                <input
                  value={festivalMessage}
                  onChange={(event) => setFestivalMessage(event.target.value)}
                  type="text"
                  placeholder="Greeting message"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="sm:col-span-3 flex items-center justify-between">
                <div className="text-xs text-red-500">{submitError}</div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isSubmitting
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  {isSubmitting ? "Adding..." : "Add Festival"}
                </button>
              </div>
            </form>
          </div>

          {localFestivals.length === 0 && localUpcomingFestivals.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[64px] text-gray-300">
                celebration
              </span>
              <p className="text-gray-500 mt-3">No festivals available</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Today
                </div>
                {localFestivals.length === 0 ? (
                  <p className="text-sm text-gray-500">No festivals today</p>
                ) : (
                  <div className="space-y-3">
                    {localFestivals.map((festival) => (
                      <div
                        key={festival.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                                {festival.name?.charAt(0) || "?"}
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">{festival.name}</h3>
                                <p className="text-sm text-gray-500">
                                  {formatFestivalDate(festival.festivalDate)}
                                </p>
                              </div>
                            </div>

                            <div className="text-sm text-gray-600 ml-15">
                              {getFestivalMessage(festival)}
                              <button
                                type="button"
                                onClick={() => startEditingFestival(festival)}
                                className="ml-2 text-xs text-primary hover:underline"
                              >
                                Edit message
                              </button>
                            </div>

                            {editingFestivalId === festival.id && (
                              <div className="mt-3">
                                <input
                                  value={editingMessage}
                                  onChange={(event) => setEditingMessage(event.target.value)}
                                  type="text"
                                  placeholder="Update greeting message"
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveMessage(festival.id)}
                                    disabled={isSavingMessage}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      isSavingMessage
                                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                        : "bg-primary text-white hover:bg-primary/90"
                                    }`}
                                  >
                                    {isSavingMessage ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditingFestival}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                                  >
                                    Cancel
                                  </button>
                                  {messageError && (
                                    <span className="text-xs text-red-500">{messageError}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                              Today! 🎊
                            </div>

                            {/* WhatsApp Wish Button */}
                            <button
                              onClick={() => sendWhatsAppWish(festival)}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white"
                              title="Send festival wish on WhatsApp"
                            >
                              <span className="material-symbols-outlined text-[16px]">send</span>
                              Wish on WhatsApp
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Upcoming (Next 30 Days)
                </div>
                {localUpcomingFestivals.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming festivals</p>
                ) : (
                  <div className="space-y-3">
                    {localUpcomingFestivals.map((festival) => {
                      const badge = getUpcomingBadge(festival.daysUntil);
                      return (
                        <div
                          key={`${festival.id}-${festival.festivalDate?.toISOString()}`}
                          className="border rounded-lg p-4 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-sky-500 flex items-center justify-center text-white font-bold text-lg">
                                  {festival.name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">{festival.name}</h3>
                                  <p className="text-sm text-gray-500">
                                    {formatFestivalDate(festival.festivalDate)}
                                  </p>
                                </div>
                              </div>

                              <div className="text-sm text-gray-600 ml-15">
                                {getFestivalMessage(festival)}
                                <button
                                  type="button"
                                  onClick={() => startEditingFestival(festival)}
                                  className="ml-2 text-xs text-primary hover:underline"
                                >
                                  Edit message
                                </button>
                              </div>

                              {editingFestivalId === festival.id && (
                                <div className="mt-3">
                                  <input
                                    value={editingMessage}
                                    onChange={(event) => setEditingMessage(event.target.value)}
                                    type="text"
                                    placeholder="Update greeting message"
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  />
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMessage(festival.id)}
                                      disabled={isSavingMessage}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        isSavingMessage
                                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                          : "bg-primary text-white hover:bg-primary/90"
                                      }`}
                                    >
                                      {isSavingMessage ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingFestival}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                    {messageError && (
                                      <span className="text-xs text-red-500">{messageError}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${badge.color}`}>
                                {badge.label}
                              </div>

                              <button
                                onClick={() => sendWhatsAppWish(festival)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white"
                                title="Send festival wish on WhatsApp"
                              >
                                <span className="material-symbols-outlined text-[16px]">send</span>
                                Wish on WhatsApp
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <p className="text-xs text-gray-500">
            💡 Tip: WhatsApp will open with a pre-filled message. Choose your recipients or a broadcast list.
          </p>
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
