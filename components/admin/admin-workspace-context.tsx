'use client';

import * as React from 'react';
import {
  ADMIN_SIDEBAR_STORAGE_KEY,
  TREE_PANEL_DEFAULT_WIDTH,
  TREE_PANEL_STORAGE_KEY,
  TREE_PANEL_WIDTH_STORAGE_KEY,
  clampTreePanelWidth,
  isEditableKeyboardTarget,
} from '@/lib/admin/workspace-layout';

type AdminWorkspaceContextValue = {
  adminSidebarCollapsed: boolean;
  setAdminSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  treePanelCollapsed: boolean;
  setTreePanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  treePanelWidth: number;
  setTreePanelWidth: (width: number) => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
};

const AdminWorkspaceContext = React.createContext<AdminWorkspaceContextValue | null>(null);

function readBooleanPreference(key: string): boolean {
  return window.localStorage.getItem(key) === 'true';
}

export function AdminWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = React.useState(false);
  const [treePanelCollapsed, setTreePanelCollapsed] = React.useState(false);
  const [treePanelWidth, setTreePanelWidthState] = React.useState(TREE_PANEL_DEFAULT_WIDTH);
  const [focusMode, setFocusMode] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdminSidebarCollapsed(readBooleanPreference(ADMIN_SIDEBAR_STORAGE_KEY));
      setTreePanelCollapsed(readBooleanPreference(TREE_PANEL_STORAGE_KEY));
      const storedWidth = Number(window.localStorage.getItem(TREE_PANEL_WIDTH_STORAGE_KEY));
      if (storedWidth) setTreePanelWidthState(clampTreePanelWidth(storedWidth));
      hydrated.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(adminSidebarCollapsed));
  }, [adminSidebarCollapsed]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    window.localStorage.setItem(TREE_PANEL_STORAGE_KEY, String(treePanelCollapsed));
  }, [treePanelCollapsed]);

  const setTreePanelWidth = React.useCallback((width: number) => {
    const next = clampTreePanelWidth(width);
    setTreePanelWidthState(next);
    window.localStorage.setItem(TREE_PANEL_WIDTH_STORAGE_KEY, String(next));
  }, []);

  const toggleFocusMode = React.useCallback(() => {
    setFocusMode((current) => {
      const next = !current;
      setAnnouncement(next ? 'Đã bật chế độ tập trung' : 'Đã thoát chế độ tập trung');
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(() => setAnnouncement(''), 1800);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setAdminSidebarCollapsed((value) => !value);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        setTreePanelCollapsed((value) => !value);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = React.useMemo<AdminWorkspaceContextValue>(
    () => ({
      adminSidebarCollapsed,
      setAdminSidebarCollapsed,
      treePanelCollapsed,
      setTreePanelCollapsed,
      treePanelWidth,
      setTreePanelWidth,
      focusMode,
      toggleFocusMode,
    }),
    [
      adminSidebarCollapsed,
      focusMode,
      treePanelCollapsed,
      treePanelWidth,
      toggleFocusMode,
      setTreePanelWidth,
    ]
  );

  return (
    <AdminWorkspaceContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] -translate-x-1/2">
        {announcement && (
          <div className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {announcement}
          </div>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </AdminWorkspaceContext.Provider>
  );
}

export function useAdminWorkspace() {
  const context = React.useContext(AdminWorkspaceContext);
  if (!context) throw new Error('useAdminWorkspace must be used inside AdminWorkspaceProvider');
  return context;
}
