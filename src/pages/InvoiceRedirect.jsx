import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function InvoiceRedirect() {
    const { id } = useParams();
    const [error, setError] = useState(null);

    useEffect(() => {
        const resolveLink = async () => {
            try {
                const { data, error } = await supabase
                    .from("short_links")
                    .select("url")
                    .eq("id", id)
                    .single();

                if (error) throw error;
                if (data?.url) {
                    window.location.href = data.url;
                } else {
                    setError("Link not found");
                }
            } catch (err) {
                console.error("Error resolving short link:", err);
                setError("Failed to resolve link");
            }
        };

        if (id) resolveLink();
    }, [id]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-800/50 px-4">
                <div className="max-w-md w-full bg-card rounded-2xl shadow-sm border p-8 text-center">
                    <div className="text-red-500 mb-4">
                        <span className="material-symbols-outlined text-5xl">error</span>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Oops!</h1>
                    <p className="text-secondary mb-6">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="w-full py-2 bg-primary text-white rounded-lg font-semibold"
                    >
                        Close Page
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-800/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-secondary font-medium">Opening your invoice...</p>
        </div>
    );
}
