import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const DashboardContext = createContext(null);

export const DashboardProvider = ({ children }) => {
  const [stats, setStats] = useState({
    members: 0,
    trainers: 0,
  });
  const [loading, setLoading] = useState(true);

  const refreshDashboard = async () => {
    try {
      setLoading(true);

      const [{ count: members }, { count: trainers }] = await Promise.all([
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("trainers").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        members: members ?? 0,
        trainers: trainers ?? 0,
      });
    } catch (err) {
      console.error("Dashboard refresh failed:", err);
      setStats({ members: 0, trainers: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        stats,
        loading,
        refreshDashboard,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);
