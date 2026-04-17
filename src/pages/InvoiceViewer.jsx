import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function InvoiceViewer() {
  const { shortId } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInvoice();
  }, [shortId]);

  const loadInvoice = async () => {
    try {
      // Look up the PDF URL from the short ID (strip .pdf if present)
      const cleanId = shortId.split(".")[0];
      const { data, error: dbError } = await supabase
        .from("invoice_links")
        .select("pdf_url")
        .eq("short_id", cleanId)
        .single();

      if (dbError || !data) {
        throw new Error("Invoice not found");
      }

      setPdfUrl(data.pdf_url);
    } catch (err) {
      console.error("Error loading invoice:", err);
      setError("Invoice not found or expired");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (pdfUrl) {
      try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `Flex_Zone_Invoice_${shortId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("Download failed:", err);
        // Fallback to direct link if blob fetch fails
        window.open(pdfUrl, "_blank");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          <div>Loading Flex Zone Invoice...</div>
        </div>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-xl mb-2">⚠️</div>
          <div>{error || "Invoice not found"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Download Button - Fixed for different screen sizes */}
      <div className="fixed z-50 right-4 top-4 hidden md:block">
        <button
          onClick={handleDownload}
          className="bg-card text-black px-6 py-3 rounded-lg font-semibold hover:bg-slate-800/30 flex items-center gap-2 shadow-lg"
        >
          <span className="material-symbols-outlined">download</span>
          Download
        </button>
      </div>

      <div className="fixed z-50 right-4 bottom-4 md:hidden">
        <button
          onClick={handleDownload}
          className="bg-card text-black w-14 h-14 rounded-full font-semibold hover:bg-slate-800/30 flex items-center justify-center gap-2 shadow-lg"
        >
          <span className="material-symbols-outlined">download</span>
        </button>
      </div>

      {/* PDF Viewer */}
      <iframe
        src={pdfUrl}
        className="w-full h-screen border-0"
        title="Invoice PDF"
      />
    </div>
  );
}