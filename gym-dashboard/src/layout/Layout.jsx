import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const Layout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // ✅ BODY SCROLL LOCK
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // ✅ TRACK SCREEN SIZE
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ backgroundColor: '#00296B', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* MOBILE HEADER */}
      <header className="fixed top-0 inset-x-0 h-14 border-b flex items-center justify-between px-4 z-40 lg:hidden" style={{ backgroundColor: '#114689', borderColor: 'rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg"
          style={{ color: '#FFFFFF' }}
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
          Dashboard
        </p>

        {/* reserved action slot */}
        <div className="w-8 h-8" />
      </header>

      <div className="flex flex-1 pt-14 lg:pt-0 overflow-hidden">
        <Sidebar
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          desktopOpen={desktopSidebarOpen}
          onDesktopHover={(isHovering) => setDesktopSidebarOpen(isHovering)}
          onToggleSidebar={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        />

        <main 
          className="flex-1 overflow-y-auto transition-all duration-300"
          style={{ 
            marginLeft: isDesktop ? (desktopSidebarOpen ? '240px' : '80px') : '0'
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;