import { useEffect } from "react";

export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  const color =
    type === "success"
      ? "bg-green-600"
      : type === "error"
      ? "bg-red-600"
      : "bg-gray-800";

  return (
    <div className="fixed top-4 right-4 z-[200]">
      <div
        className={`${color} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium`}
      >
        {message}
      </div>
    </div>
  );
}
