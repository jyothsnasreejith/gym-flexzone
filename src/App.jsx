import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "./layout/Layout";
import { supabase } from "./supabaseClient";

// Auth
import Login from "./pages/auth/Login";
import AuthCallback from "./pages/auth/AuthCallback";
import SetPassword from "./pages/auth/SetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

// Admin pages
import Dashboard from "./pages/Dashboard";
import Enquiries from "./pages/Enquiries";
import Packages from "./pages/Packages";
import Trainers from "./pages/Trainers";
import TrainerDetails from "./pages/TrainerDetails";
import AddTrainer from "./pages/AddTrainer";
import MembersList from "./pages/MembersList";
import Members from "./pages/Members";
import AdminTrash from "./pages/AdminTrash";
import AddMember from "./pages/AddMember";
import EditMember from "./pages/EditMember";
import RenewMember from "./pages/RenewMember";
import Offers from "./pages/Offers";
import Reports from "./pages/Reports";
import ReportsCollection from "./pages/ReportsCollection";
import ReportsMembers from "./pages/ReportsMembers";
import ReportsMemberExpiryBilling from "./pages/ReportsMemberExpiryBilling";
import ReportsExpired from "./pages/ReportsExpired";
import ReportsProfitLoss from "./pages/ReportsProfitLoss";
import ReportsMemberCollection from "./pages/ReportsMemberCollection";
import InvoiceViewer from './pages/InvoiceViewer';
import AdminBatchSlotSettings from "./pages/AdminBatchSlotSettings";
import MemberAttendance from "./pages/MemberAttendance";


// Other admin modules
import MemberFeeHistory from "./pages/MemberFeeHistory";
import MessageTemplateManager from "./pages/MessageTemplateManager";
import MassCommunication from "./pages/MassCommunication";
import SystemSettings from "./pages/SystemSettings";

// Trainer
import TrainerDashboard from "./pages/trainer/TrainerDashboard";
import EditTrainer from "./pages/EditTrainer";
import AddBill from "./pages/Billing/AddBill";
import Fees from "./pages/Billing/Fees";
import BillDetail from "./pages/Billing/BillDetail";
import Expenses from "./pages/Expenses";
import AddOns from "./pages/AddOns";

import PublicJoin from "./pages/PublicJoin";
import PublicMembers from "./pages/PublicMembers";
import InvoiceRedirect from "./pages/InvoiceRedirect";

const App = () => {
  const location = useLocation();

  useEffect(() => {
    const initialPath = window.location.pathname;
    const isPublicRouteAtInit =
      initialPath === "/join" ||
      initialPath.startsWith("/members/public") ||
      initialPath.startsWith("/myprofile");

    if (isPublicRouteAtInit) {
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      const currentPath = window.location.pathname;
      const isPublicRoute =
        currentPath === "/join" ||
        currentPath.startsWith("/members/public") ||
        currentPath.startsWith("/myprofile");

      if (isPublicRoute) return;

      if (event === "TOKEN_REFRESH_FAILED" || event === "SIGNED_OUT") {
        localStorage.removeItem("auth_user");
        window.location.href = "/login";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  return (
    <ErrorBoundary>
      <Routes>

        {/* ===== AUTH / PUBLIC ===== */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/set-password" element={<SetPassword />} />

        {/* ===== STANDALONE PAGE (NO LAYOUT) ===== */}
        <Route
          path="/members/new"
          element={
            <ProtectedRoute allow={["admin"]}>
              <AddMember />
            </ProtectedRoute>
          }
        />
        <Route path="/join" element={<PublicJoin />} />
        <Route path="/members/public" element={<PublicMembers />} />
        <Route path="/myprofile" element={<PublicMembers />} />
        <Route path="/i/:shortId" element={<InvoiceViewer />} />
        <Route path="/i/:shortId.pdf" element={<InvoiceViewer />} />

        {/* ===== PROTECTED APP (WITH LAYOUT) ===== */}
        <Route element={<Layout />}>

          {/* DASHBOARD */}
          <Route
            path="/"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/enquiries"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Enquiries />
              </ProtectedRoute>
            }
          />

          <Route
            path="/packages"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Packages />
              </ProtectedRoute>
            }
          />

          <Route
            path="/add-ons"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AddOns />
              </ProtectedRoute>
            }
          />

          <Route
            path="/offers"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Offers />
              </ProtectedRoute>
            }
          />

          {/* TRAINERS */}
          <Route
            path="/trainers"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Trainers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trainers/new"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AddTrainer />
              </ProtectedRoute>
            }
          />

          {/* legacy route — kept intentionally */}
          <Route
            path="/add-trainer"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AddTrainer />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trainers/:id"
            element={
              <ProtectedRoute allow={["admin"]}>
                <TrainerDetails />
              </ProtectedRoute>
            }
          />

          {/* MEMBERS */}
          <Route
            path="/members"
            element={
              <ProtectedRoute allow={["admin"]}>
                <MembersList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Members />
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id/edit"
            element={
              <ProtectedRoute allow={["admin"]}>
                <EditMember />
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id/renew"
            element={
              <ProtectedRoute allow={["admin"]}>
                <RenewMember />
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id/fee-history"
            element={
              <ProtectedRoute allow={["admin"]}>
                <MemberFeeHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members/:id/attendance"
            element={
              <ProtectedRoute allow={["admin"]}>
                <MemberAttendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/trash"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminTrash />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/add"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AddBill />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Fees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allow={["admin"]}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/collection"
            element={
              <ProtectedRoute allow={["admin"]}>
                <ReportsCollection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/members"
            element={
              <ProtectedRoute allow={["admin"]}>
                <ReportsMembers />
              </ProtectedRoute>
            }
          />
          <Route            path="/reports/member-expiry-billing"
            element={
              <ProtectedRoute>
                <ReportsMemberExpiryBilling />
              </ProtectedRoute>
            }
          />
          <Route            path="/reports/expired"
            element={
              <ProtectedRoute allow={["admin"]}>
                <ReportsExpired />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/profit-loss"
            element={
              <ProtectedRoute allow={["admin"]}>
                <ReportsProfitLoss />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/member-collection"
            element={
              <ProtectedRoute allow={["admin"]}>
                <ReportsMemberCollection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/:id"
            element={
              <ProtectedRoute allow={["admin"]}>
                <BillDetail />
              </ProtectedRoute>
            }
          />


          {/* COMMUNICATION */}
          <Route
            path="/templates"
            element={
              <ProtectedRoute allow={["admin"]}>
                <MessageTemplateManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="/mass-communication"
            element={
              <ProtectedRoute allow={["admin"]}>
                <MassCommunication />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute allow={["admin"]}>
                <SystemSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/batch-slots/settings"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminBatchSlotSettings />
              </ProtectedRoute>
            }
          />

          {/* TRAINER */}
          <Route
            path="/trainer/dashboard"
            element={
              <ProtectedRoute allow={["trainer"]}>
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainers/:id/edit"
            element={
              <ProtectedRoute allow={["admin"]}>
                <EditTrainer />
              </ProtectedRoute>
            }
          />
        </Route>


      </Routes>
    </ErrorBoundary>
  );
};

export default App;
