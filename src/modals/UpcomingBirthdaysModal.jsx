import { useModal } from "../context/ModalContext";
import { openWhatsAppClient } from "../utils/communicationHelpers";

export default function UpcomingBirthdaysModal({ birthdays, emailTemplates = [] }) {
  const { closeModal } = useModal();

  const formatBirthday = (dateStr) => {
    // Parse YYYY-MM-DD format
    const parts = dateStr.split('-');
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const date = new Date(2000, month, day); // Use any year, we only need month/day

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
    });
  };

  const getBadgeColor = (daysUntil) => {
    if (daysUntil === 0) return "bg-red-100 text-red-700";
    if (daysUntil <= 7) return "bg-orange-100 text-orange-700";
    if (daysUntil <= 14) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  const getBadgeText = (daysUntil) => {
    if (daysUntil === 0) return "Today! 🎉";
    if (daysUntil === 1) return "Tomorrow";
    return `In ${daysUntil} days`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600">cake</span>
              Upcoming Birthdays
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {birthdays.length} birthday{birthdays.length !== 1 ? "s" : ""} in the next 30 days
            </p>
          </div>
          <button
            onClick={closeModal}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </button>
        </div>

        {/* BODY */}
        <div className="px-6 py-4 overflow-y-auto">
          {birthdays.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[64px] text-gray-300">
                cake
              </span>
              <p className="text-gray-500 mt-3">No upcoming birthdays in the next 30 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {birthdays.map((member) => (
                <div
                  key={member.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                          {member.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{member.full_name}</h3>
                          <p className="text-sm text-gray-500">{member.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 ml-15">
                        <span className="material-symbols-outlined text-[18px]">
                          calendar_today
                        </span>
                        <span>{formatBirthday(member.dob)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getBadgeColor(member.daysUntil)}`}>
                        {getBadgeText(member.daysUntil)}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => {
                            const bdayTmpl = emailTemplates.find(t => t.title.toLowerCase().includes("birthday") && t.mode === "whatsapp");
                            openWhatsAppClient(member, bdayTmpl, {
                              birthdayDate: formatBirthday(member.dob)
                            }, "birthday");
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors"
                          title="Send WhatsApp Wish"
                        >
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t flex justify-between items-center">
          <p className="text-xs text-gray-500">
            💡 Tip: Send them a birthday wish to strengthen member relationships
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
