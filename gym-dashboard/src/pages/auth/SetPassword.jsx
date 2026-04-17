import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetPassword = async () => {
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Password successfully set
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-md bg-card rounded-xl p-8 shadow">
        <h1 className="text-2xl font-bold mb-2">Set your password</h1>
        <p className="text-secondary mb-6">
          Please create a password to continue.
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 border rounded px-4 mb-4"
        />

        <button
          onClick={handleSetPassword}
          disabled={loading}
          className="w-full h-12 bg-primary text-white rounded font-bold"
        >
          {loading ? "Saving..." : "Set Password"}
        </button>
      </div>
    </div>
  );
}
