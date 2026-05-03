import { useNavigate } from "react-router-dom";

const cards = [
  {
    title: "Collection Report",
    subtitle: "Day-wise collections",
    icon: "bar_chart",
    tone: "from-primary-blue to-navy border-emerald-100",
    iconTone: "bg-emerald-100 text-emerald-600",
    path: "/reports/collection",
  },
  {
    title: "Member List",
    subtitle: "Members by joining date",
    icon: "groups",
    tone: "from-primary-blue to-navy border-amber-100",
    iconTone: "bg-amber-100 text-amber-700",
    path: "/reports/members",
  },
  {
    title: "Member Expiry & Billing",
    subtitle: "Join date, expiry date, and bill dates",
    icon: "calendar_month",
    tone: "from-primary-blue to-navy border-purple-100",
    iconTone: "bg-purple-100 text-purple-600",
    path: "/reports/member-expiry-billing",
  },
  {
    title: "Expired Members",
    subtitle: "Members expired before today",
    icon: "event_busy",
    tone: "from-primary-blue to-navy border-rose-100",
    iconTone: "bg-rose-100 text-rose-600",
    path: "/reports/expired",
  },
  {
    title: "Profit & Loss",
    subtitle: "Income vs expense",
    icon: "calculate",
    tone: "from-primary-blue to-navy border-slate-700/30",
    iconTone: "bg-slate-200 text-slate-700",
    path: "/reports/profit-loss",
  },
  {
    title: "Member Collection",
    subtitle: "Payment-wise member collections",
    icon: "payments",
    tone: "from-primary-blue to-navy border-secondary-blue",
    iconTone: "bg-blue-100 text-blue-600",
    path: "/reports/member-collection",
  },
];

const ReportCard = ({ title, subtitle, icon, tone, iconTone, onClick }) => (
  <div
    onClick={onClick}
    className={`border rounded-2xl p-4 shadow-sm bg-gradient-to-br ${tone} flex flex-col h-[220px] cursor-pointer`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="text-xs text-secondary mt-1">{subtitle}</p>
      </div>
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center border border-white/50 shadow-sm ${iconTone}`}
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
    </div>
  </div>
);

export default function Reports() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto w-full p-6 space-y-6 bg-navy">
      <div>
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="text-secondary">
          Select a report to view details, filters, and CSV exports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <ReportCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            icon={card.icon}
            tone={card.tone}
            iconTone={card.iconTone}
            onClick={() => navigate(card.path)}
          />
        ))}
      </div>
    </main>
  );
}
