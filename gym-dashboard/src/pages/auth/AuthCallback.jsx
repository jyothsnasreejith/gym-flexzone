import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // This is REQUIRED for invite / reset / magic links
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        navigate("/login");
        return;
      }

      // Force password creation after invite
      navigate("/set-password");
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      Completing setup…
    </div>
  );
}
