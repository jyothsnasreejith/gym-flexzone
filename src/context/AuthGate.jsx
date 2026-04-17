import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      // 1️⃣ if already cached → allow immediately
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        setReady(true);
        return;
      }

      // 2️⃣ otherwise check Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // minimal placeholder (full profile fetched later)
        localStorage.setItem(
          "auth_user",
          JSON.stringify({ id: session.user.id })
        );
      }

      setReady(true);
    };

    hydrate();
  }, []);

  // ⏳ block app until auth is resolved
  if (!ready) return null; // or spinner

  return children;
}
