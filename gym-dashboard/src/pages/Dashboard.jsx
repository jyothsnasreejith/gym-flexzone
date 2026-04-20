import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboard } from "../dashboardApi";
import { supabase } from "../supabaseClient";
import { useModal } from "../context/ModalContext";
import TodaysBirthdaysModal from "../modals/TodaysBirthdaysModal";
import ExpiredMembersModal from "../modals/ExpiredMembersModal";
import UpcomingBirthdaysModal from "../modals/UpcomingBirthdaysModal";
import TodaysFestivalsModal from "../modals/TodaysFestivalsModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { normalizePaymentStatus } from "../utils/paymentStatus";
import { getFestivalsForDate, getUpcomingFestivals } from "../data/festivals";
import { openEmailClient, openWhatsAppClient } from "../utils/communicationHelpers";

const toDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const withRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      // If it's a 525 error or network error, wait and retry
      console.warn(`Retry ${i + 1}/${retries} failed...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const filterOptions = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "mtd", label: "MTD" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

export default function Dashboard() {
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    members: 0,
    activeMembers: 0,
    trainers: 0,
    revenue: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [revenueFilter, setRevenueFilter] = useState("today"); // Independent filter for Revenue
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [paymentsFilter, setPaymentsFilter] = useState("today"); // Independent filter for Recent Payments
  const [newMembersFilter, setNewMembersFilter] = useState("today"); // Independent filter for New Members
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [todaysFestivals, setTodaysFestivals] = useState([]);
  const [upcomingFestivals, setUpcomingFestivals] = useState([]);
  const [loadingFestivals, setLoadingFestivals] = useState(false);
  const [todaysCollection, setTodaysCollection] = useState({
    paid: 0,
    pending: 0,
    total: 0
  });
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [revenueTotalRange, setRevenueTotalRange] = useState(0);
  const [filteredCollection, setFilteredCollection] = useState({
    paid: 0,
    pending: 0,
    total: 0
  });
  const [newMembers, setNewMembers] = useState([]);
  const [loadingNewMembers, setLoadingNewMembers] = useState(false);
  const [expensesFilter, setExpensesFilter] = useState("today");
  const [expensesList, setExpensesList] = useState([]);
  const [expensesTotalRange, setExpensesTotalRange] = useState(0);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [revenueExpensesTotal, setRevenueExpensesTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [expiredMembers, setExpiredMembers] = useState([]);
  const [loadingExpired, setLoadingExpired] = useState(false);

  // Calculate range for REVENUE chart
  const { revenueRangeStart, revenueRangeEnd } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (revenueFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "mtd":
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "6m":
        start.setMonth(end.getMonth() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "1y":
        start.setFullYear(end.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    return { revenueRangeStart: start, revenueRangeEnd: end };
  }, [revenueFilter]);

  // Calculate range for RECENT PAYMENTS
  const { paymentsRangeStart, paymentsRangeEnd } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (paymentsFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "mtd":
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "6m":
        start.setMonth(end.getMonth() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "1y":
        start.setFullYear(end.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    return { paymentsRangeStart: start, paymentsRangeEnd: end };
  }, [paymentsFilter]);

  const paymentsRangeStartDate = toDateOnly(paymentsRangeStart);
  const paymentsRangeEndDate = toDateOnly(paymentsRangeEnd);

  // Calculate range for NEW MEMBERS
  const { newMembersRangeStart, newMembersRangeEnd } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (newMembersFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "mtd":
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "6m":
        start.setMonth(end.getMonth() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "1y":
        start.setFullYear(end.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    return { newMembersRangeStart: start, newMembersRangeEnd: end };
  }, [newMembersFilter]);

  const { expensesRangeStart, expensesRangeEnd } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (expensesFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "mtd":
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "6m":
        start.setMonth(end.getMonth() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "1y":
        start.setFullYear(end.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    return { expensesRangeStart: start, expensesRangeEnd: end };
  }, [expensesFilter]);


  const filteredRevenue = revenueData.filter((r) => {
    const d = new Date(r.month);
    return d >= revenueRangeStart && d <= revenueRangeEnd;
  }).map((r) => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    value: Number(r.total_expected_revenue) || 0,
  }));

  const expectedRevenueTotal = revenueData
    .filter((r) => {
      const d = new Date(r.month);
      return d >= revenueRangeStart && d <= revenueRangeEnd;
    })
    .reduce(
      (acc, cur) => acc + Number(cur.total_expected_revenue || 0),
      0
    );

  const chartData = filteredRevenue.map((r) => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    value: Number(r.total_expected_revenue) || 0,
  }));

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchDashboard();

        setStats((prev) => ({
          ...prev,
          members: Number(data.members) || 0,
          activeMembers: Number(data.activeMembers) || 0,
          trainers: Number(data.trainers) || 0,
          revenue: Number(data.revenue) || 0,
        }));
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    const loadExpectedRevenue = async () => {
      try {
        // First, get all members who joined in the revenue filter range
        const { data: membersData, error: membersError } = await withRetry(() =>
          supabase
            .from("members")
            .select("id")
            .gte("joining_date", toDateOnly(revenueRangeStart))
            .lte("joining_date", toDateOnly(revenueRangeEnd))
            .eq("is_deleted", false)
        );

        if (membersError) throw membersError;

        const memberIds = (membersData || []).map(m => m.id);

        // Get revenue data from RPC
        const { data, error } = await withRetry(() => supabase.rpc("get_expected_revenue"));

        if (error) throw error;

        // Filter to only include revenue from members who joined in the selected range
        const filteredByMembers = (data || []).filter(rev => memberIds.includes(rev.member_id));
        setRevenueData(filteredByMembers);
      } catch (err) {
        console.error("Failed to load expected revenue:", err);
        setRevenueData([]);
      }
    };

    loadExpectedRevenue();
  }, [revenueRangeStart, revenueRangeEnd]);

  /* ===============================
     LOAD TODAY'S COLLECTION (PAID & PENDING)
  =============================== */
  useEffect(() => {
    const loadTodaysCollection = async () => {
      try {
        const today = toDateOnly(new Date());

        // Get members who joined today
        const { data: membersData, error: membersError } = await withRetry(() =>
          supabase
            .from("members")
            .select("id")
            .eq("joining_date", today)
            .eq("is_deleted", false)
        );

        if (membersError) throw membersError;

        const memberIds = (membersData || []).map(m => m.id);

        if (memberIds.length === 0) {
          setTodaysCollection({
            paid: 0,
            pending: 0,
            total: 0
          });
          return;
        }

        // Get bills for these members
        const { data: billsData, error: billsError } = await withRetry(() =>
          supabase
            .from("bills")
            .select("id")
            .in("member_id", memberIds)
        );

        if (billsError) throw billsError;

        const billIds = (billsData || []).map(b => b.id);

        if (billIds.length === 0) {
          setTodaysCollection({
            paid: 0,
            pending: 0,
            total: 0
          });
          return;
        }

        // Get today's payments from these bills (paid)
        const { data: paidData, error: paidError } = await withRetry(() =>
          supabase
            .from("payments")
            .select("amount_paid")
            .in("bill_id", billIds)
            .eq("status", "paid")
        );

        if (paidError) throw paidError;

        const paidAmount = (paidData || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );

        // Get pending payments from these bills
        const { data: pendingData, error: pendingError } = await withRetry(() =>
          supabase
            .from("payments")
            .select("amount_paid")
            .in("bill_id", billIds)
            .eq("status", "pending")
        );

        if (pendingError) throw pendingError;

        const pendingAmount = (pendingData || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );

        setTodaysCollection({
          paid: paidAmount,
          pending: pendingAmount,
          total: paidAmount + pendingAmount
        });
      } catch (err) {
        console.error("Failed to load today's collection:", err);
      }
    };

    loadTodaysCollection();
  }, []);

  /* ===============================
     LOAD FILTERED COLLECTION FOR REVENUE (Based on revenueFilter)
  =============================== */
  useEffect(() => {
    const loadFilteredCollection = async () => {
      try {
        const startDate = toDateOnly(revenueRangeStart);
        const endDate = toDateOnly(revenueRangeEnd);

        // Get payments in range (paid)
        const { data: paidData, error: paidError } = await withRetry(() =>
          supabase
            .from("payments")
            .select("amount_paid")
            .gte("payment_date", startDate)
            .lte("payment_date", endDate)
        );

        if (paidError) throw paidError;

        const paidAmount = (paidData || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );

        // Get pending payments in range
        const { data: pendingData, error: pendingError } = await withRetry(() =>
          supabase
            .from("payments")
            .select("amount_paid")
            .eq("status", "pending")
            .gte("payment_date", startDate)
            .lte("payment_date", endDate)
        );

        if (pendingError) throw pendingError;

        const pendingAmount = (pendingData || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );

        setFilteredCollection({
          paid: paidAmount,
          pending: pendingAmount,
          total: paidAmount + pendingAmount
        });
      } catch (err) {
        console.error("Failed to load filtered collection:", err);
      }
    };

    loadFilteredCollection();
  }, [revenueRangeStart, revenueRangeEnd]);

  /* ===============================
     LOAD EXPENSE TOTAL FOR REVENUE RANGE (NET)
  =============================== */
  useEffect(() => {
    const loadRevenueExpenses = async () => {
      try {
        const startDate = revenueRangeStart.toISOString();
        const endDate = revenueRangeEnd.toISOString();

        const { data, error } = await withRetry(() =>
          supabase
            .from("expenses")
            .select("amount")
            .gte("expense_at", startDate)
            .lte("expense_at", endDate)
        );

        if (error) throw error;

        const total = (data || []).reduce(
          (sum, e) => sum + Number(e.amount || 0),
          0
        );
        setRevenueExpensesTotal(total);
      } catch (err) {
        console.error("Failed to load expenses for net:", err);
        setRevenueExpensesTotal(0);
      }
    };

    loadRevenueExpenses();
  }, [revenueRangeStart, revenueRangeEnd]);

  /* ===============================
     LOAD TODAY'S BIRTHDAYS
  =============================== */
  useEffect(() => {
    const loadTodaysBirthdays = async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("members")
            .select("id, full_name, dob, phone, end_date")
            .not("dob", "is", null)
        );

        if (error) throw error;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Filter active members only
        const activeMembers = (data || []).filter(m =>
          !m.end_date || m.end_date >= todayStr
        );

        // Filter members with birthday today
        const todayMonth = today.getMonth() + 1; // 1-12
        const todayDay = today.getDate();

        const birthdaysToday = activeMembers.filter(member => {
          const dobParts = member.dob.split('-');
          const dobMonth = parseInt(dobParts[1]);
          const dobDay = parseInt(dobParts[2]);

          return dobMonth === todayMonth && dobDay === todayDay;
        });

        setTodaysBirthdays(birthdaysToday);
      } catch (err) {
        console.error("Failed to load today's birthdays:", err);
      }
    };

    loadTodaysBirthdays();
  }, []);

  useEffect(() => {
    const loadEmailTemplates = async () => {
      try {
        const { data } = await supabase.from("templates").select("*").eq("mode", "email");
        setEmailTemplates(data || []);
      } catch (err) {
        console.error("Failed to load email templates:", err);
      }
    };
    loadEmailTemplates();
  }, []);

  /* ===============================
     LOAD TODAY'S FESTIVALS
  =============================== */
  const loadFestivals = useCallback(async () => {
    try {
      setLoadingFestivals(true);
      const { data, error } = await withRetry(() =>
        supabase
          .from("festivals")
          .select("id, name, festival_date, message, is_active")
          .eq("is_active", true)
      );

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const today = new Date();
      setTodaysFestivals(getFestivalsForDate(rows, today));
      setUpcomingFestivals(getUpcomingFestivals(rows, today, 30, false));
    } catch (err) {
      console.error("Failed to load festivals:", err);
      setTodaysFestivals([]);
      setUpcomingFestivals([]);
    } finally {
      setLoadingFestivals(false);
    }
  }, []);

  useEffect(() => {
    loadFestivals();
  }, [loadFestivals]);

  /* ===============================
     LOAD EXPIRED MEMBERS
  =============================== */
  useEffect(() => {
    const loadExpiredMembers = async () => {
      try {
        setLoadingExpired(true);
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        // 1. Package-expired members
        const { data: pkgData, error: pkgError } = await withRetry(() =>
          supabase
            .from("members")
            .select(`
              id,
              full_name,
              phone,
              email,
              end_date,
              package_variants (
                duration_value,
                duration_unit,
                packages (title)
              )
            `)
            .lt("end_date", today)
            .not("end_date", "is", null)
            .order("end_date", { ascending: false })
            .limit(10)
        );

        if (pkgError) throw pkgError;

        const memberMap = {};
        (pkgData || []).forEach(m => {
          const expiry = new Date(m.end_date);
          const days = Math.floor((now - expiry) / (1000 * 60 * 60 * 24));
          memberMap[m.id] = { ...m, daysSinceExpiry: days, expiredAddOns: [] };
        });

        // 2. Add-on-expired members
        const { data: aoData, error: aoError } = await withRetry(() =>
          supabase
            .from("member_add_ons")
            .select("member_id, end_date, add_ons(name)")
            .lt("end_date", today)
            .not("end_date", "is", null)
        );

        if (!aoError) {
          const expiredAddOnsByMember = {};
          (aoData || []).forEach(row => {
            if (!expiredAddOnsByMember[row.member_id]) expiredAddOnsByMember[row.member_id] = [];
            expiredAddOnsByMember[row.member_id].push({
              name: row.add_ons?.name || "Add-on",
              end_date: row.end_date,
            });
          });

          const addOnOnlyIds = Object.keys(expiredAddOnsByMember).filter(id => !memberMap[id]);
          if (addOnOnlyIds.length > 0) {
            const { data: aoMembers } = await withRetry(() =>
              supabase
                .from("members")
                .select("id, full_name, phone, email, end_date, package_variants(duration_value, duration_unit, packages(title))")
                .in("id", addOnOnlyIds)
            );
            (aoMembers || []).forEach(member => {
              const addOns = expiredAddOnsByMember[member.id] || [];
              const earliestExpiry = addOns.reduce((min, ao) => (!min || ao.end_date < min ? ao.end_date : min), null);
              const expiry = new Date(earliestExpiry);
              const days = Math.floor((now - expiry) / (1000 * 60 * 60 * 24));
              memberMap[member.id] = { ...member, end_date: earliestExpiry, daysSinceExpiry: days, expiredAddOns: addOns };
            });
          }

          // Attach add-on info to package-expired members too
          Object.keys(expiredAddOnsByMember).forEach(memberId => {
            if (memberMap[memberId]) memberMap[memberId].expiredAddOns = expiredAddOnsByMember[memberId];
          });
        }

        const processed = Object.values(memberMap)
          .sort((a, b) => new Date(b.end_date) - new Date(a.end_date))
          .slice(0, 10);

        setExpiredMembers(processed);
      } catch (err) {
        console.error("Failed to load expired members:", err);
      } finally {
        setLoadingExpired(false);
      }
    };

    loadExpiredMembers();
  }, []);

  /* ===============================
     LOAD UPCOMING BIRTHDAYS (Next 30 days)
  =============================== */
  useEffect(() => {
    const loadUpcomingBirthdays = async () => {
      try {
        const { data, error } = await withRetry(() =>
          supabase
            .from("members")
            .select("id, full_name, dob, phone, end_date, email")
            .not("dob", "is", null)
        );

        if (error) throw error;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Filter active members only
        const activeMembers = (data || []).filter(m =>
          !m.end_date || m.end_date >= todayStr
        );

        // Filter birthdays in next 30 days
        const upcoming = activeMembers
          .map(member => {
            const dobParts = member.dob.split('-');
            const dobMonth = parseInt(dobParts[1]) - 1;
            const dobDay = parseInt(dobParts[2]);

            // Create birthday for this year
            const thisYearBirthday = new Date(
              today.getFullYear(),
              dobMonth,
              dobDay
            );
            thisYearBirthday.setHours(0, 0, 0, 0);

            // If birthday already passed this year, use next year
            let nextBirthday = thisYearBirthday;
            if (thisYearBirthday < today) {
              nextBirthday = new Date(
                today.getFullYear() + 1,
                dobMonth,
                dobDay
              );
              nextBirthday.setHours(0, 0, 0, 0);
            }

            const daysUntil = Math.round(
              (nextBirthday - today) / (1000 * 60 * 60 * 24)
            );

            return {
              ...member,
              nextBirthday,
              daysUntil,
            };
          })
          .filter(m => m.daysUntil >= 0 && m.daysUntil <= 7)
          .sort((a, b) => a.daysUntil - b.daysUntil);

        setUpcomingBirthdays(upcoming);
      } catch (err) {
        console.error("Failed to load upcoming birthdays:", err);
      }
    };

    loadUpcomingBirthdays();
  }, []);

  /* ===============================
     LOAD RECENT PAYMENTS (Based on paymentsFilter)
  =============================== */
  useEffect(() => {
    const loadRecentPayments = async () => {
      try {
        setLoadingPayments(true);

        // First, get all members who joined in the selected date range
        const { data: membersData, error: membersError } = await withRetry(() =>
          supabase
            .from("members")
            .select("id")
            .gte("joining_date", paymentsRangeStartDate)
            .lte("joining_date", paymentsRangeEndDate)
            .eq("is_deleted", false)
        );

        if (membersError) throw membersError;

        const memberIds = (membersData || []).map(m => m.id);

        if (memberIds.length === 0) {
          setRecentPayments([]);
          setRevenueTotalRange(0);
          setLoadingPayments(false);
          return;
        }

        // Get all bills for these members
        const { data: billsData, error: billsError } = await withRetry(() =>
          supabase
            .from("bills")
            .select("id")
            .in("member_id", memberIds)
        );

        if (billsError) throw billsError;

        const billIds = (billsData || []).map(b => b.id);

        if (billIds.length === 0) {
          setRecentPayments([]);
          setRevenueTotalRange(0);
          setLoadingPayments(false);
          return;
        }

        // Get payments for these bills
        const { data, error } = await withRetry(() =>
          supabase
            .from("payments")
            .select("id, amount_paid, payment_date, created_at, status, method")
            .in("bill_id", billIds)
            .order("payment_date", { ascending: false })
            .limit(10)
        );

        if (error) throw error;

        const rows = data || [];
        setRecentPayments(rows);
        setRevenueTotalRange(
          rows.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
        );
      } catch (err) {
        console.error("Failed to load recent payments:", err);
        setRecentPayments([]);
        setRevenueTotalRange(0);
      } finally {
        setLoadingPayments(false);
      }
    };

    loadRecentPayments();
  }, [paymentsRangeStartDate, paymentsRangeEndDate]);

  /* ===============================
     LOAD NEW MEMBERS (Based on newMembersFilter)
  =============================== */
  useEffect(() => {
    const loadNewMembers = async () => {
      try {
        setLoadingNewMembers(true);
        const startDate = newMembersRangeStart.toISOString();
        const endDate = newMembersRangeEnd.toISOString();

        const { data, error } = await withRetry(() =>
          supabase
            .from("members")
            .select("id, full_name, admission_no, profile_image_url, created_at, joining_date")
            .eq("is_deleted", false)
            .gte("joining_date", startDate)
            .lte("joining_date", endDate)
            .order("joining_date", { ascending: false })
        );

        if (error) throw error;
        setNewMembers(data || []);
      } catch (err) {
        console.error("Failed to load new members:", err);
        setNewMembers([]);
      } finally {
        setLoadingNewMembers(false);
      }
    };

    loadNewMembers();
  }, [newMembersRangeStart, newMembersRangeEnd]);

  /* ===============================
     LOAD EXPENSES (Based on expensesFilter)
  =============================== */
  useEffect(() => {
    const loadExpenses = async () => {
      try {
        setLoadingExpenses(true);
        const startDate = expensesRangeStart.toISOString();
        const endDate = expensesRangeEnd.toISOString();

        const { data, error } = await withRetry(() =>
          supabase
            .from("expenses")
            .select("id, amount, expense_at, expense_type, expense_subtypes(name)")
            .gte("expense_at", startDate)
            .lte("expense_at", endDate)
            .order("expense_at", { ascending: false })
            .limit(10)
        );

        if (error) throw error;

        const rows = data || [];
        setExpensesList(rows);
        setExpensesTotalRange(
          rows.reduce((sum, e) => sum + Number(e.amount || 0), 0)
        );
      } catch (err) {
        console.error("Failed to load expenses:", err);
        setExpensesList([]);
        setExpensesTotalRange(0);
      } finally {
        setLoadingExpenses(false);
      }
    };

    loadExpenses();
  }, [expensesRangeStart, expensesRangeEnd]);
  /* ===============================
     LOAD UPCOMING REMINDERS (DUE/EXPIRY IN 2 DAYS)
  =============================== */
  useEffect(() => {
    const loadReminders = async () => {
      try {
        setLoadingReminders(true);
        const today = new Date();
        const twoDaysLater = new Date(today);
        twoDaysLater.setDate(today.getDate() + 2);
        const targetDate = toDateOnly(twoDaysLater);

        // 1. Fetch bills due in 2 days
        const { data: bills, error: billsErr } = await withRetry(() =>
          supabase
            .from("bills")
            .select("id, member_id, due_date, amount, payable_amount, discount_amount, members(id, full_name, phone, email), packages:packages!bills_package_id_fkey(title)")
            .eq("due_date", targetDate)
            .eq("payment_status", "unpaid")
            .eq("is_current", true)
        );

        // 2. Fetch memberships expiring in 2 days
        const { data: expiries, error: expErr } = await withRetry(() =>
          supabase
            .from("members")
            .select("id, full_name, phone, email, end_date, package_variant_id, package_variants(packages(title))")
            .eq("end_date", targetDate)
        );

        const reminders = [];

        // Process bills
        (bills || []).forEach(b => {
          reminders.push({
            id: `bill-${b.id}`,
            member: b.members,
            memberId: b.member_id,
            type: "upcoming_fee",
            date: b.due_date,
            label: "Fee Due",
            extra: {
              balance: b.payable_amount || (Number(b.amount) - Number(b.discount_amount || 0)),
              due_date: b.due_date,
              packageName: b.packages?.title
            }
          });
        });

        // Process expiries
        (expiries || []).forEach(m => {
          reminders.push({
            id: `expiry-${m.id}`,
            member: { full_name: m.full_name, phone: m.phone, email: m.email },
            memberId: m.id,
            type: "upcoming_expiry",
            date: m.end_date,
            label: "Package Expiry",
            extra: {
              end_date: m.end_date,
              packageName: m.package_variants?.packages?.title
            }
          });
        });

        setUpcomingReminders(reminders);
      } catch (err) {
        console.error("Failed to load reminders:", err);
      } finally {
        setLoadingReminders(false);
      }
    };

    loadReminders();
  }, []);


  return (
    <div className="min-h-screen bg-navy">
      <div className="p-6 mx-auto w-full">
        {/* HEADER WITH FILTER */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full badge-info text-xs font-semibold">
              Overview
            </div>
            <h1 className="text-3xl font-bold text-white mt-3">Dashboard</h1>
            <p className="text-secondary">Overview of gym activity</p>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* STATS ROW 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            label="Total Members"
            value={loading ? "—" : stats.members}
            tone="blue"
          />

          <StatCard
            label="Active Members"
            value={loading ? "—" : stats.activeMembers}
            onClick={() => navigate("/members?status=active")}
            tone="green"
          />

          <StatCard
            label="Total Trainers"
            value={loading ? "—" : stats.trainers}
            tone="amber"
          />

          {/* TODAY'S COLLECTION CARD WITH PAID & PENDING */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-rose-100 rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-secondary mb-1">Today's Collection</p>
            <p className="text-3xl font-bold text-white">
              {loading ? "—" : `₹${todaysCollection.total}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-secondary">Paid: ₹{todaysCollection.paid}</span>
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span className="text-secondary">Pending: ₹{todaysCollection.pending}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION NEEDED / REMINDERS - ONLY SHOW IF NOT EMPTY */}
        {!loadingReminders && upcomingReminders.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500">priority_high</span>
                Action Needed
                <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                  Due in 2 Days
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {upcomingReminders.map(rem => (
                <div
                  key={rem.id}
                  onClick={() => navigate(`/members/${rem.memberId}`)}
                  className="bg-primary-blue border hover:border-orange-200 transition-all rounded-xl p-3 shadow-sm flex flex-col justify-between cursor-pointer group hover:shadow-md"
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${rem.type === "upcoming_fee" ? "bg-red-200 text-red-800" : "bg-purple-50 text-purple-600"
                        }`}>
                        {rem.label}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">{new Date(rem.date).toLocaleDateString("en-GB")}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm">{rem.member?.full_name}</h3>
                    <p className="text-[11px] text-secondary truncate">{rem.extra.packageName || "No Package"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsAppClient(rem.member, null, rem.extra, rem.type);
                      }}
                      className="flex-1 badge-success hover:bg-green-100 transition-colors py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">chat</span>
                      WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHARTS ROW - REVENUE, PAYMENTS, NEW MEMBERS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 mb-6">
          {/* REVENUE CHART */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col min-h-0 h-[300px] sm:h-[320px] lg:h-[360px] overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Revenue</h3>
              <FilterDropdown
                value={revenueFilter}
                onChange={setRevenueFilter}
                options={filterOptions}
              />
            </div>

            {/* Revenue Total */}
            <div className="mb-3">
              <p className="text-xs text-secondary">Total Revenue</p>
              <p className="text-xl font-bold text-white">₹{filteredCollection.total.toFixed(2)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-secondary">Paid: ₹{filteredCollection.paid.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-secondary">Pending: ₹{filteredCollection.pending.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-secondary">
                Net:{" "}
                <span
                  className={`font-semibold ${filteredCollection.total - revenueExpensesTotal >= 0
                    ? "text-green-600"
                    : "text-red-600"
                    }`}
                >
                  ₹{(filteredCollection.total - revenueExpensesTotal).toFixed(2)}
                </span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="text-secondary text-sm text-center py-8">
                No billing data available
              </div>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `₹${v}`} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* RECENT PAYMENTS */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent Payments</h2>
              <FilterDropdown
                value={paymentsFilter}
                onChange={setPaymentsFilter}
                options={filterOptions}
              />
            </div>

            {/* Payment Summary */}
            <div className="mb-3 pb-2 border-b">
              <p className="text-xs text-secondary">Total Collected</p>
              <p className="text-xl font-bold text-white">₹{revenueTotalRange.toFixed(2)}</p>
              <p className="text-xs text-secondary mt-1">{recentPayments.length} payment{recentPayments.length !== 1 ? 's' : ''}</p>
            </div>

            {loadingPayments ? (
              <div className="text-sm text-secondary text-center py-8">Loading payments…</div>
            ) : recentPayments.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">
                No payments in selected range
              </div>
            ) : (
              <div className="divide-y flex-1 min-h-0 max-h-[120px] overflow-y-auto pr-1">
                {recentPayments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-white">₹{Number(p.amount_paid || 0).toFixed(2)}</div>
                      <div className="text-xs text-secondary">
                        {(() => {
                          const ts = p.created_at || p.payment_date;
                          if (!ts) return "—";
                          // Ensure UTC interpretation — Supabase may omit timezone suffix
                          const normalized = ts.includes('T') && !ts.includes('Z') && !ts.includes('+') ? ts + 'Z' : ts;
                          const d = new Date(normalized);
                          if (isNaN(d.getTime())) return "—";
                          // If created_at has time info, show date + time
                          if (p.created_at) {
                            return d.toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            });
                          }
                          // payment_date is date-only, show just the date
                          return d.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short"
                          });
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-secondary">{p.method || "—"}</div>
                      {(() => {
                        const normalized = normalizePaymentStatus(p.status);
                        const label =
                          normalized === "paid"
                            ? "Paid"
                            : normalized === "partial"
                              ? "Partial"
                              : normalized === "pending"
                                ? "Pending"
                                : normalized === "unpaid"
                                  ? "Due"
                                  : (p.status || "—");

                        const colorClass =
                          normalized === "paid"
                            ? "text-green-600"
                            : normalized === "partial"
                              ? "text-orange-600"
                              : normalized === "pending"
                                ? "text-orange-600"
                                : normalized === "unpaid"
                                  ? "text-red-600"
                                  : "text-secondary";

                        return (
                          <div className={`text-xs font-medium ${colorClass}`}>
                            {label}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EXPENSES */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Expenses</h2>
              <FilterDropdown
                value={expensesFilter}
                onChange={setExpensesFilter}
                options={filterOptions}
              />
            </div>

            <div className="mb-3 pb-2 border-b">
              <p className="text-xs text-secondary">Total Expenses</p>
              <p className="text-xl font-bold text-white">₹{expensesTotalRange.toFixed(2)}</p>
              <p className="text-xs text-secondary mt-1">
                {expensesList.length} expense{expensesList.length !== 1 ? "s" : ""}
              </p>
            </div>

            {loadingExpenses ? (
              <div className="text-sm text-secondary text-center py-8">Loading expenses…</div>
            ) : expensesList.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">
                No expenses in selected range
              </div>
            ) : (
              <div className="divide-y flex-1 min-h-0 max-h-[120px] overflow-y-auto pr-1">
                {expensesList.map((e) => (
                  <div key={e.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-white">
                        ₹{Number(e.amount || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-secondary">
                        {e.expense_type}
                        {e.expense_subtypes?.name ? ` · ${e.expense_subtypes.name}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-secondary">
                      {e.expense_at
                        ? new Date(e.expense_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NEW MEMBERS */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">New Members</h2>
              <FilterDropdown
                value={newMembersFilter}
                onChange={setNewMembersFilter}
                options={filterOptions}
              />
            </div>

            <div className="mb-3 pb-2 border-b">
              <p className="text-xs text-secondary">New Joinings</p>
              <p className="text-xl font-bold text-white">{newMembers.length}</p>
            </div>

            {loadingNewMembers ? (
              <div className="text-sm text-secondary text-center py-8">
                Loading members…
              </div>
            ) : newMembers.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">
                No new members in selected range
              </div>
            ) : (
              <div className="space-y-3 max-h-[150px] overflow-hidden pr-1">
                {newMembers.map((m) => {
                  const joinedOn = m.joining_date || m.created_at;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => navigate(`/members/${m.id}`)}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:bg-slate-800/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {m.profile_image_url ? (
                            <img
                              src={m.profile_image_url}
                              alt={m.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            m.full_name?.charAt(0) || "?"
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {m.full_name}
                          </div>
                          <div className="text-xs text-secondary font-mono truncate">
                            {m.admission_no || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-secondary whitespace-nowrap">
                        {joinedOn
                          ? new Date(joinedOn).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })
                          : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* STATS ROW 2 - INTERACTIVE CARDS (TODAY'S BIRTHDAYS & EXPIRED MEMBERS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* TODAY'S BIRTHDAYS */}
          <ClickableStatCard
            label="Today's Birthdays"
            value={todaysBirthdays.length > 0 ? "🎉" : "—"}
            subtitle={todaysBirthdays.length > 0
              ? `${todaysBirthdays.map(b => b.full_name).join(", ")}`
              : "No birthdays today"}
            icon="cake"
            color="purple"
            showIllustration={todaysBirthdays.length === 0}
            illustrationIcon="cake"
            illustrationText="No birthdays today"
            onClick={() => openModal(<TodaysBirthdaysModal birthdays={todaysBirthdays} />)}
          />

          {/* TODAY'S FESTIVALS */}
          <ClickableStatCard
            label="Today's Festivals"
            value={loadingFestivals ? "…" : (todaysFestivals.length > 0 ? "🎊" : "—")}
            subtitle={todaysFestivals.length > 0
              ? `${todaysFestivals.map(f => f.name).join(", ")}`
              : (loadingFestivals ? "Loading festivals…" : "No festivals today")}
            icon="celebration"
            color="green"
            showIllustration={!loadingFestivals && todaysFestivals.length === 0}
            illustrationIcon="celebration"
            illustrationText="No festivals today"
            onClick={() => openModal(
              <TodaysFestivalsModal
                festivals={todaysFestivals}
                upcomingFestivals={upcomingFestivals}
                onFestivalAdded={loadFestivals}
              />
            )}
          />

          {/* UPCOMING BIRTHDAYS */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Upcoming Birthdays</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openModal(<UpcomingBirthdaysModal birthdays={upcomingBirthdays} emailTemplates={emailTemplates} />)}
                  className="px-2 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-xs font-bold transition-all shadow-sm"
                >
                  View All
                </button>
              </div>
            </div>

            {/* Birthday Count */}
            <div className="mb-3 pb-2 border-b">
              <p className="text-xs text-secondary">Next 7 Days</p>
              <p className="text-xl font-bold text-white">{upcomingBirthdays.length}</p>
              <p className="text-xs text-secondary mt-1">upcoming birthday{upcomingBirthdays.length !== 1 ? 's' : ''}</p>
            </div>

            {upcomingBirthdays.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">
                <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">
                  cake
                </span>
                <p>No upcoming birthdays</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto scrollbar-hide">
                {upcomingBirthdays.slice(0, 3).map((member) => {
                  const getBadgeColor = (days) => {
                    if (days === 0) return "bg-red-100 text-red-700";
                    if (days <= 7) return "bg-orange-100 text-orange-700";
                    return "bg-blue-100 text-blue-700";
                  };

                  const getBadgeText = (days) => {
                    if (days === 0) return "Today";
                    if (days === 1) return "Tomorrow";
                    return `${days}d`;
                  };

                  return (
                    <div
                      key={member.id}
                      onClick={() => navigate(`/members/${member.id}`)}
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate text-blue-700">{member.full_name}</h3>
                          <p className="text-xs text-blue-600 truncate">{member.phone || "No phone"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getBadgeColor(member.daysUntil)}`}>
                          {getBadgeText(member.daysUntil)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const bdayTmpl = emailTemplates.find(t => t.title.toLowerCase().includes("birthday") && t.mode === "whatsapp");
                            openWhatsAppClient(member, bdayTmpl, {
                              birthdayDate: member.nextBirthday.toLocaleDateString("en-GB")
                            }, "birthday");
                          }}
                          className="p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors"
                          title="Send WhatsApp Wish"
                        >
                          <span className="material-symbols-outlined text-[18px]">chat</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* EXPIRED MEMBERS */}
          <div className="bg-gradient-to-br from-primary-blue to-navy border border-secondary-blue rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">Expired Members</h2>
              <button
                onClick={() => openModal(<ExpiredMembersModal emailTemplates={emailTemplates} />)}
                className="px-2 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 text-xs font-bold transition-all shadow-sm"
              >
                View All
              </button>
            </div>

            <div className="mb-3 pb-2 border-b">
              <p className="text-xs text-secondary">Need Renewal</p>
              <p className="text-xl font-bold text-white">{expiredMembers.length === 10 ? "10+" : expiredMembers.length}</p>
              <p className="text-xs text-secondary mt-1">recently expired</p>
            </div>

            {loadingExpired ? (
              <div className="text-sm text-secondary text-center py-8">Loading...</div>
            ) : expiredMembers.length === 0 ? (
              <div className="text-center py-8 text-secondary">
                <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">
                  check_circle
                </span>
                <p className="text-sm">No expired memberships</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                {expiredMembers.slice(0, 6).map((member) => {
                  const getUrgencyColor = (days) => {
                    if (days <= 7) return "bg-red-100 text-red-700";
                    if (days <= 30) return "bg-orange-100 text-orange-700";
                    return "bg-slate-100 text-slate-700";
                  };

                  return (
                    <div
                      key={member.id}
                      onClick={() => navigate(`/members/${member.id}`)}
                      className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate text-rose-700">{member.full_name}</h3>
                          <p className="text-[10px] text-rose-600 truncate">
                            {member.package_variants?.packages?.title || "No Package"}
                            {member.package_variants?.duration_value && ` - ${member.package_variants.duration_value} ${member.package_variants.duration_unit}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${getUrgencyColor(member.daysSinceExpiry)}`}>
                          {member.daysSinceExpiry}d
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/members/${member.id}/renew`);
                            }}
                            className="p-1 rounded-full hover:bg-rose-200 text-rose-600 transition-colors"
                            title="Renew Membership"
                          >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsAppClient(member, null, { end_date: member.end_date }, "expiry");
                            }}
                            className="p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors"
                            title="Send WhatsApp Reminder"
                          >
                            <span className="material-symbols-outlined text-[18px]">chat</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const FilterDropdown = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const activeLabel =
    options.find((option) => option.value === value)?.label || "Filter";

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Filter: ${activeLabel}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/20 bg-card text-secondary shadow-sm transition hover:bg-slate-800/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className="material-symbols-outlined text-[18px]">
          filter_list
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-32 rounded-xl border border-slate-700/20 bg-card p-1 text-xs shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${value === option.value
                ? "bg-primary text-white shadow-sm"
                : "text-secondary hover:bg-slate-800/50"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* =======================
   STAT CARD
======================= */
const StatCard = ({ label, value, onClick, tone = "slate" }) => {
  const tones = {
    slate: "bg-gradient-to-br from-primary-blue to-navy border-slate-700/30",
    blue: "bg-gradient-to-br from-primary-blue to-navy border-secondary-blue",
    green: "bg-gradient-to-br from-primary-blue to-navy border-green-100",
    amber: "bg-gradient-to-br from-primary-blue to-navy border-amber-100",
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-2xl p-6 shadow-sm ${tones[tone] || tones.slate} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
        }`}
    >
      <p className="text-sm text-secondary mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
};

/* =======================
   CLICKABLE STAT CARD
======================= */
const ClickableStatCard = ({
  label,
  value,
  subtitle,
  icon,
  color,
  onClick,
  showIllustration = false,
  illustrationIcon,
  illustrationText,
}) => {
  const toneClasses = {
    blue: "bg-gradient-to-br from-primary-blue to-navy border-secondary-blue",
    purple: "bg-gradient-to-br from-primary-blue to-navy border-indigo-100",
    red: "bg-gradient-to-br from-primary-blue to-navy border-rose-100",
    green: "bg-gradient-to-br from-primary-blue to-navy border-emerald-100",
  };

  const iconClasses = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-rose-100 text-rose-600",
    green: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div
      onClick={onClick}
      className={`border rounded-2xl p-4 shadow-sm flex flex-col h-[300px] sm:h-[320px] lg:h-[360px] cursor-pointer transition-all group ${toneClasses[color] || toneClasses.blue
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white">{label}</h2>
        <div className={`p-2 rounded-lg ${iconClasses[color] || iconClasses.blue}`}>
          <span className="material-symbols-outlined text-[20px]">
            {icon}
          </span>
        </div>
      </div>

      <div className="mb-3 pb-2 border-b">
        <p className="text-xl font-bold text-white">{value}</p>
        {subtitle && !showIllustration && (
          <p className="text-xs text-secondary mt-1 line-clamp-2">{subtitle}</p>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        {showIllustration && (
          <div className="text-center text-secondary">
            <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">
              {illustrationIcon || icon}
            </span>
            {illustrationText && <p className="text-sm">{illustrationText}</p>}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
        View Details
        <span className="material-symbols-outlined text-[16px]">
          arrow_forward
        </span>
      </div>
    </div>
  );
};
