import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useState } from "react";

const Sidebar = ({ open, onClose, desktopOpen = false, onDesktopHover, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  let startX = null;

  const base =
    "group relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition";
  const inactive = "hover:bg-opacity-50 transition-colors";
  const active = "font-semibold";
  const icon = "material-symbols-outlined text-[20px] w-5 text-inherit";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("auth_user");
    localStorage.removeItem("token");
    onClose();
    navigate("/login");
  };

  const navClass = ({ isActive }) => `${base} ${isActive ? active : inactive}`;

  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (!startX) return;

    const currentX = e.touches[0].clientX;
    const deltaX = startX - currentX;

    if (deltaX > 60) {
      onClose();
      startX = null;
    }
  };

  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <>
      {/* MOBILE OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* SIDEBAR - Desktop Collapsible */}
      <aside
        className={`
          hidden lg:flex lg:flex-col lg:justify-between
          fixed left-0 top-0 h-screen z-30
          border-r px-4 py-4
          transition-all duration-300
          ${desktopOpen ? "lg:w-60" : "lg:w-20"}
        `}
        style={{
          backgroundColor: '#114689',
          borderColor: 'rgba(255,255,255,0.08)'
        }}
        onMouseEnter={() => onDesktopHover && onDesktopHover(true)}
        onMouseLeave={() => onDesktopHover && onDesktopHover(false)}
      >
        {/* TOP */}
        <div>
          {/* HAMBURGER MENU + BRAND */}
          <div className="flex items-center gap-2 px-2 mb-8">
            <button
              onClick={() => onToggleSidebar && onToggleSidebar()}
              className="p-2 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ color: '#FFFFFF' }}
              aria-label="Toggle sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            {/* BRAND LOGO */}
            <div className={`flex items-center gap-2 transition-opacity flex-shrink-0 ${desktopOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ring-1 p-1" style={{ backgroundColor: 'rgba(244,196,0,0.15)', borderColor: 'rgba(244,196,0,0.3)' }}>
                <img
                  src={logoUrl}
                  alt="Flex Zone"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className="font-semibold text-sm" style={{ color: '#FFFFFF' }}>FLEX ZONE</div>
                <div className="text-xs" style={{ color: '#D1D5DB' }}>Admin</div>
              </div>
            </div>
          </div>

          {/* MAIN NAV */}
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Dashboard"
            >
              <span className={icon}>dashboard</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Dashboard</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/members"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Members"
            >
              <span className={icon}>group</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Members</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/enquiries"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Enquiries"
            >
              <span className={icon}>contact_support</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Enquiries</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/packages"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Packages"
            >
              <span className={icon}>calendar_month</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Packages</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/add-ons"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Add On"
            >
              <span className={icon}>extension</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Add On</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/admin/batch-slots/settings"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Time Slots"
            >
              <span className={icon}>schedule</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Time Slots</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/offers"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Offers & Coupons"
            >
              <span className={icon}>local_offer</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Offers & Coupons</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/trainers"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Trainers"
            >
              <span className={icon}>fitness_center</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Trainers</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/billing"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Fee"
            >
              <span className={icon}>receipt_long</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Fee</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/expenses"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Expense"
            >
              <span className={icon}>payments</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Expense</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/reports"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
              title="Reports"
            >
              <span className={icon}>bar_chart</span>
              <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Reports</span>
              <ActiveIndicator />
            </NavLink>
          </nav>
        </div>

        {/* SYSTEM */}
        <div className={`pt-4 border-t transition-opacity ${desktopOpen ? "opacity-100" : "opacity-0"}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className={`px-2 mb-2 text-xs font-semibold uppercase ${desktopOpen ? "opacity-100" : "opacity-0"}`} style={{ color: '#9CA3AF' }}>
            System
          </div>

          <NavLink
            to="/settings"
            onClick={onClose}
            className={navClass}
            style={({ isActive }) => ({
              backgroundColor: isActive ? '#1B5FA8' : 'transparent',
              color: '#FFFFFF'
            })}
            title="Settings"
          >
            <span className={icon}>settings</span>
            <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Settings</span>
            <ActiveIndicator />
          </NavLink>

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className={`${base} mt-2 text-red-600 hover:bg-red-50`}
            title="Logout"
          >
            <span className={`${icon} text-red-600`}>logout</span>
            <span className={`${desktopOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* SIDEBAR - Mobile */}
      <aside
        className={`
          lg:hidden
          fixed inset-y-0 left-0 z-50 flex flex-col justify-between
          w-[78%] max-w-[280px]
          border-r px-4 py-6
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          backgroundColor: '#114689',
          borderColor: 'rgba(255,255,255,0.08)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* TOP */}
        <div>
          {/* BRAND */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="w-11 h-11 rounded-full flex items-center justify-center overflow-hidden ring-1 p-1.5" style={{ backgroundColor: 'rgba(244,196,0,0.15)', borderColor: 'rgba(244,196,0,0.3)' }}>
              <img
                src={logoUrl}
                alt="Flex Zone"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="font-semibold" style={{ color: '#FFFFFF' }}>FLEX ZONE</div>
              <div className="text-xs" style={{ color: '#D1D5DB' }}>Admin Panel</div>
            </div>
          </div>

          {/* MAIN NAV */}
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>dashboard</span>
              <span>Dashboard</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/members"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>group</span>
              <span>Members</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/enquiries"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>contact_support</span>
              <span>Enquiries</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/packages"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>calendar_month</span>
              <span>Packages</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/add-ons"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>extension</span>
              <span>Add On</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/admin/batch-slots/settings"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>schedule</span>
              <span>Time Slots</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/offers"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>local_offer</span>
              <span>Offers & Coupons</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/trainers"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>fitness_center</span>
              <span>Trainers</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/billing"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>receipt_long</span>
              <span>Fee</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/expenses"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>payments</span>
              <span>Expense</span>
              <ActiveIndicator />
            </NavLink>

            <NavLink
              to="/reports"
              onClick={onClose}
              className={navClass}
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#1B5FA8' : 'transparent',
                color: '#FFFFFF'
              })}
            >
              <span className={icon}>bar_chart</span>
              <span>Reports</span>
              <ActiveIndicator />
            </NavLink>
          </nav>
        </div>

        {/* SYSTEM */}
        <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="px-2 mb-2 text-xs font-semibold uppercase" style={{ color: '#9CA3AF' }}>
            System
          </div>

          <NavLink
            to="/settings"
            onClick={onClose}
            className={navClass}
            style={({ isActive }) => ({
              backgroundColor: isActive ? '#1B5FA8' : 'transparent',
              color: '#FFFFFF'
            })}
          >
            <span className={icon}>settings</span>
            <span>Settings</span>
            <ActiveIndicator />
          </NavLink>

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className={`${base} mt-2 text-red-600 hover:bg-red-50`}
          >
            <span className={`${icon} text-red-600`}>logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

/* ===== Active Indicator ===== */
const ActiveIndicator = () => (
  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-primary opacity-0 group-[.active]:opacity-100" />
);

export default Sidebar;
