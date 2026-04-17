import { Link } from "react-router-dom";

export default function ActionButtons({
  viewTo,
  onEdit,
  onDelete,
  size = "md",
}) {
  const base =
    "flex items-center justify-center rounded-lg transition focus:outline-none";

  const sizes = {
    sm: {
      btn: "w-7 h-7",
      icon: "text-[16px]",
    },
    md: {
      btn: "w-8 h-8",
      icon: "text-[17px]",
    },
  };

  const cfg = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-2">
      {/* VIEW */}
      {viewTo && (
        <Link
          to={viewTo}
          title="View"
          className={`${base} ${cfg.btn} bg-blue-50 text-blue-600 hover:bg-blue-100`}
        >
          <span className={`material-symbols-outlined ${cfg.icon}`}>
            visibility
          </span>
        </Link>
      )}

      {/* EDIT */}
      {onEdit && (
        <button
          type="button"
          title="Edit"
          onClick={onEdit}
          className={`${base} ${cfg.btn} bg-amber-50 text-amber-600 hover:bg-amber-100`}
        >
          <span className={`material-symbols-outlined ${cfg.icon}`}>
            edit
          </span>
        </button>
      )}

      {/* DELETE */}
      {onDelete && (
        <button
          type="button"
          title="Delete"
          onClick={onDelete}
          className={`${base} ${cfg.btn} bg-red-50 text-red-600 hover:bg-red-100`}
        >
          <span className={`material-symbols-outlined ${cfg.icon}`}>
            delete
          </span>
        </button>
      )}
    </div>
  );
}
