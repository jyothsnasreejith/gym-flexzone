import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function ProtectedRoute({ allow, children }) {
  const location = useLocation();
  const raw = localStorage.getItem("auth_user");
  const user = raw ? JSON.parse(raw) : null;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (allow && user.role && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}
