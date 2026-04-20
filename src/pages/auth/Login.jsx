import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const raw = localStorage.getItem("auth_user");
      if (!raw) return;

      let user;
      try {
        user = JSON.parse(raw);
      } catch {
        return;
      }

      if (user.role === "admin") navigate("/", { replace: true });
      else if (user.role === "trainer") navigate("/trainer/dashboard", { replace: true });
      else if (user.role === "member") navigate("/member/dashboard", { replace: true });
    };

    checkSession();
  }, [navigate]);


  // where the user wanted to go before login
  const redirectTo = location.state?.from || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError("");
    setLoading(true);

    /* =======================
       AUTHENTICATE USER
    ======================= */
    const { data, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    /* =======================
       FETCH PROFILE
    ======================= */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setError("Profile not found. Contact administrator.");
      setLoading(false);
      return;
    }

    /* =======================
       TRAINER LOOKUP (IF ANY)
    ======================= */
    let trainer_id = null;

    if (profile.role === "trainer") {
      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .select("id")
        .eq("email", user.email)
        .single();

      if (trainerError || !trainer) {
        setError("Trainer record not found. Contact administrator.");
        setLoading(false);
        return;
      }

      trainer_id = trainer.id;
    }

    /* =======================
       STORE SESSION LOCALLY
    ======================= */
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: user.id,
        email: user.email,
        role: profile.role,
        full_name: profile.full_name,
        trainer_id,
      })
    );

    /* =======================
       REDIRECT LOGIC
    ======================= */

    // 1️⃣ return to originally requested page
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
    }
    // 2️⃣ fallback by role
    else if (profile.role === "admin") {
      navigate("/", { replace: true });
    }
    else if (profile.role === "trainer") {
      navigate("/trainer/dashboard", { replace: true });
    }
    else if (profile.role === "member") {
      navigate("/member/dashboard", { replace: true });
    }
    else {
      setError("Invalid user role");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] font-display">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1599058917212-d750089bc07a"
          alt="Gym background"
          className="w-full h-full object-cover blur-[2px] opacity-40"
        />
        <div className="absolute inset-0 bg-[#f6f7f8]/90" />
      </div>

      {/* LOGIN CARD */}
      <div className="relative z-10 w-full max-w-[480px] bg-card rounded-xl shadow-lg border border-[#e6e8eb] overflow-hidden">
        {/* HEADER */}
        <div className="pt-8 px-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary">
              lock
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-black">
            Welcome 
          </h1>

          <p className="text-[#637588]">
            Please Enter your details to sign in.
          </p>
        </div>

        {/* FORM */}
        <div className="p-8 pt-2">
          {error && (
            <p className="mb-4 text-sm text-red-600 text-center">
              {error}
            </p>
          )}

          <form
            onSubmit={handleLogin}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLogin(e);
              }
            }}
            className="flex flex-col gap-5"
          >
            {/* EMAIL */}
            <div>
              <label className="block mb-2 font-medium text-black">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 rounded-lg border border-[#dce0e5] bg-[#f8f9fa] px-4 pr-12 focus:ring-2 focus:ring-primary text-black"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#637588]">
                  mail
                </span>
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="font-medium text-black">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 rounded-lg border border-[#dce0e5] bg-[#f8f9fa] px-4 pr-12 focus:ring-2 focus:ring-primary text-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#637588]"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-12 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 transition"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
