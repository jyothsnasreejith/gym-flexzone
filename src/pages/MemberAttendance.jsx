import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PageHeader from "../components/PageHeader";

const formatTime = (t) =>
  t ? String(t).slice(0, 5) : "--";

const getMonthYearString = (date) => {
  const d = new Date(date);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const withRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export default function MemberAttendance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [totalCountBefore, setTotalCountBefore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Fetch member basic info
      const { data: memberData, error: memberError } = await withRetry(() =>
        supabase
          .from("members")
          .select("id, full_name, admission_no")
          .eq("id", id)
          .single()
      );

      if (memberError) throw memberError;
      setMember(memberData);

      // 2. Fetch from External API and Sync
      // We extract the numeric part of admission_no (e.g., FZ-0012 -> 12)
      const memberNumericId = memberData.admission_no?.split("-").pop()?.replace(/^0+/, "") || "";

      try {
        const response = await fetch("https://gravity-innovations.com/gymmanage/gymmanage/api/attendance.php");
        const json = await response.json();
        const apiRecords = json.data || [];

        // Filter records for this member
        // Matching by comparing numeric parts of EmployeeName and admission_no
        const myRecords = apiRecords.filter(item => {
          const empNumeric = String(item.EmployeeName || "").replace(/^0+/, "");
          return empNumeric === memberNumericId;
        });

        if (myRecords.length > 0) {
          const formatTime = (timeStr) => {
            if (!timeStr || timeStr === "00:00:00") return "00:00";
            const match = timeStr.match(/(\d{2}:\d{2})/);
            return match ? match[1] : "00:00";
          };

          const upsertData = myRecords.map(item => ({
            member_id: id,
            date: item.Date,
            punch_in: formatTime(item.InTime),
            punch_out: formatTime(item.OutTime),
            status: 'Present',
          }));

          // Upsert to Supabase - using member_id and date and punch_in as a makeshift unique key 
          // (assuming one record per punch session)
          const { error: upsertError } = await supabase
            .from("member_attendance")
            .upsert(upsertData, {
              onConflict: 'member_id, date, punch_in'
            });

          if (upsertError) {
            console.warn("Sync upsert failed (ignore if unique constraint missing):", upsertError);
            // Fallback to simple insert if upsert fails
            await supabase.from("member_attendance").insert(upsertData);
          }
        }
      } catch (apiErr) {
        console.error("External API Sync failed:", apiErr.message);
        // We continue even if API fails, to show cached database records
      }

      // 3. Fetch attendance for selected month (now includes synced records)
      const startOfMonth = `${selectedMonth}-01`;
      const nextMonth = new Date(selectedMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endOfMonth = nextMonth.toISOString().slice(0, 10);

      const { count: countBefore, error: countError } = await withRetry(() =>
        supabase
          .from("member_attendance")
          .select("*", { count: 'exact', head: true })
          .eq("member_id", id)
          .lt("date", startOfMonth)
      );

      if (!countError) {
        setTotalCountBefore(countBefore || 0);
      }

      const { data: attData, error: attError } = await withRetry(() =>
        supabase
          .from("member_attendance")
          .select("*")
          .eq("member_id", id)
          .gte("date", startOfMonth)
          .lt("date", endOfMonth)
          .order("date", { ascending: true })
      );

      if (!attError) {
        setAttendance(attData || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !member) return <div className="p-6">Loading…</div>;
  if (!member) return <div className="p-6">Member not found</div>;

  const presentDays = attendance.filter(a => a.status === 'Present').length;
  const absentDays = attendance.filter(a => a.status === 'Absent' || a.status === 'Leave').length;

  // Calculate total hours worked and prepare log data
  let totalMinutes = 0;
  const processedAttendance = attendance.map((record, index) => {
    const [h1, m1] = (record.punch_in || "00:00").split(':').map(Number);
    const [h2, m2] = (record.punch_out || "00:00").split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff > 0) totalMinutes += diff;

    const punchCount = totalCountBefore + index + 1;
    return {
      ...record,
      durationLabel: record.punch_in && record.punch_out ?
        `${Math.floor(diff / 60)} hrs ${diff % 60} mins` : "0 hrs 0 mins",
      punchCount
    };
  });

  const sortedLog = [...processedAttendance].reverse();
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 bg-navy h-[calc(100vh-96px)] flex flex-col overflow-hidden">
      <div className="sticky top-0 z-20 bg-navy pb-4 space-y-6">
        <PageHeader
          title={`Attendance - ${member.full_name}`}
          backTo={`/members/${id}`}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
        {/* FILTER */}
        <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-slate-700/20">
          <span className="text-sm font-medium text-white">Filter by Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-primary focus:border-primary"
          />
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card p-6 rounded-xl border border-slate-700/20 shadow-sm">
            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Days Present</div>
            <div className="text-3xl font-bold text-white">{presentDays}</div>
          </div>
          <div className="bg-card p-6 rounded-xl border border-slate-700/20 shadow-sm">
            <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Days Absent/Leave</div>
            <div className="text-3xl font-bold text-white">{absentDays}</div>
          </div>
          <div className="bg-card p-6 rounded-xl border border-slate-700/20 shadow-sm">
            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Total Hours Worked</div>
            <div className="text-3xl font-bold text-white">{totalHrs} hrs {totalMins} mins</div>
          </div>
        </div>

        {/* ATTENDANCE LOG */}
        <div className="bg-card rounded-xl border border-slate-700/20 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-700/20 bg-gray-50/50">
            <h3 className="font-bold text-white">Attendance Log for {getMonthYearString(selectedMonth)}</h3>
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-secondary uppercase tracking-wider bg-gray-50/50 border-b border-slate-700/20">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Punch In</th>
                  <th className="px-6 py-4">Punch Out</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4 text-center">Count</th>
                  <th className="px-6 py-4">Class / Area</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {sortedLog.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-secondary italic">
                      No attendance records found for this month.
                    </td>
                  </tr>
                ) : (
                  sortedLog.map((record) => (
                    <tr key={record.id} className={record.status === 'Absent' ? 'bg-red-50/30' : ''}>
                      <td className="px-6 py-4 font-mono">{record.date}</td>
                      <td className="px-6 py-4 font-medium">{formatTime(record.punch_in)}</td>
                      <td className="px-6 py-4 font-medium">{formatTime(record.punch_out)}</td>
                      <td className="px-6 py-4">{record.durationLabel}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs ring-2 ring-blue-50">
                          {record.punchCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-secondary font-medium">{record.class_area || "N/A"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden">
            {sortedLog.length === 0 ? (
              <div className="px-6 py-10 text-center text-secondary italic">
                No attendance records found for this month.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {sortedLog.map((record) => (
                  <div key={record.id} className={`p-4 ${record.status === 'Absent' ? 'bg-red-50/30' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="font-mono text-sm">{record.date}</div>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs ring-2 ring-blue-50">
                        {record.punchCount}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-secondary">Punch In</div>
                        <div className="font-medium">{formatTime(record.punch_in)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-secondary">Punch Out</div>
                        <div className="font-medium">{formatTime(record.punch_out)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-secondary">Duration</div>
                        <div>{record.durationLabel}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-secondary">
                      Class / Area: {record.class_area || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
