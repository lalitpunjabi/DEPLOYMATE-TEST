import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CommandPalette } from './CommandPalette';
import { AiFloatingDrawer } from './AiFloatingDrawer';

export const Layout: React.FC = () => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background noise-bg relative">
      {/* Aurora visual background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-secondary/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-[200px] w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/5 to-cyan-500/5 blur-[150px] pointer-events-none z-0" />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-64 relative z-10">
        {/* Top Navbar */}
        <Navbar />

        {/* Dashboard Views */}
        <main className="pt-16 p-8 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Assistant Drawer */}
      <AiFloatingDrawer />

      {/* Raycast command palette overlay */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </div>
  );
};
