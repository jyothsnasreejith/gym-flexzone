import { useNavigate } from "react-router-dom";

export default function PageHeader({
  title,
  backTo,
  actionLabel,
  onAction,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="p-2 rounded-full hover:bg-gray-100 active:scale-95 sm:hidden"
            aria-label="Go back"
          >
            ←
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-primary text-white px-4 py-2 rounded-lg font-semibold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
