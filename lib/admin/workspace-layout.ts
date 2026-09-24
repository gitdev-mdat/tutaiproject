export const ADMIN_SIDEBAR_EXPANDED_WIDTH = 224;
export const ADMIN_SIDEBAR_COLLAPSED_WIDTH = 68;

export const TREE_PANEL_DEFAULT_WIDTH = 340;
export const TREE_PANEL_MIN_WIDTH = 280;
export const TREE_PANEL_MAX_WIDTH = 480;

export const ADMIN_SIDEBAR_STORAGE_KEY = 'tutai:admin-sidebar-collapsed';
export const TREE_PANEL_STORAGE_KEY = 'tutai:tree-panel-collapsed';
export const TREE_PANEL_WIDTH_STORAGE_KEY = 'tutai:tree-panel-width';

export function clampTreePanelWidth(width: number): number {
  if (!Number.isFinite(width)) return TREE_PANEL_DEFAULT_WIDTH;
  return Math.min(TREE_PANEL_MAX_WIDTH, Math.max(TREE_PANEL_MIN_WIDTH, Math.round(width)));
}

export function resolveWorkspacePanels({
  adminSidebarCollapsed,
  treePanelCollapsed,
  focusMode,
}: {
  adminSidebarCollapsed: boolean;
  treePanelCollapsed: boolean;
  focusMode: boolean;
}) {
  return {
    adminSidebarHidden: focusMode,
    adminSidebarWidth: focusMode
      ? 0
      : adminSidebarCollapsed
        ? ADMIN_SIDEBAR_COLLAPSED_WIDTH
        : ADMIN_SIDEBAR_EXPANDED_WIDTH,
    treePanelHidden: focusMode || treePanelCollapsed,
  };
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
