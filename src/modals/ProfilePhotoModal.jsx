import { useState } from "react";

export default function ProfilePhotoModal({ isOpen, onClose, photoUrl, memberName }) {
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 bg-primary-blue rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary-blue">
          <h2 className="text-xl font-bold text-white">{memberName} - Profile Photo</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Image Container */}
        <div className="relative bg-black/40 p-6 overflow-auto max-h-[70vh] flex items-center justify-center">
          <img
            src={photoUrl}
            alt={memberName}
            style={{
              transform: `scale(${zoom})`,
              transition: "transform 0.2s ease-out",
            }}
            className="max-w-full h-auto cursor-zoom-in rounded-lg"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-6 border-t border-secondary-blue bg-secondary-blue/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
              className="p-2 rounded-lg bg-primary-blue hover:bg-secondary-blue transition-colors text-white"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined">zoom_out</span>
            </button>

            <div className="bg-primary-blue px-4 py-2 rounded-lg">
              <span className="text-white font-semibold">{Math.round(zoom * 100)}%</span>
            </div>

            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.2))}
              className="p-2 rounded-lg bg-primary-blue hover:bg-secondary-blue transition-colors text-white"
              title="Zoom In"
            >
              <span className="material-symbols-outlined">zoom_in</span>
            </button>

            <button
              onClick={() => setZoom(1)}
              className="p-2 rounded-lg bg-primary-blue hover:bg-secondary-blue transition-colors text-white ml-2"
              title="Reset Zoom"
            >
              <span className="material-symbols-outlined">fit_screen</span>
            </button>
          </div>

          <button
            onClick={() => {
              const link = document.createElement("a");
              link.href = photoUrl;
              link.download = `${memberName}-profile.jpg`;
              link.click();
            }}
            className="px-6 py-2 bg-gold text-navy font-semibold rounded-lg hover:bg-gold-bright transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
