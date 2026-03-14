import { useEffect } from "react";
import { X, AlertCircle, Minus, Square, Settings, Search } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar, Workspace, Inspector } from "@/components/layout";
import { CreateSessionModal } from "@/components/session";
import { FocusMode } from "@/components/timer";
import { SettingsModal } from "@/components/settings";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSessionStore, useSettingsStore, useUIStore, useTimerStore } from "@/stores";
import { useTheme } from "@/hooks/useTheme";
import "./index.css";

// Minimal custom titlebar for Linux
function TitleBar() {
  const appWindow = getCurrentWindow();
  const { setSettingsModalOpen, setSearchOpen } = useUIStore();

  const onMinimize = () => appWindow.minimize();
  const onMaximize = async () => {
    const isMax = await appWindow.isMaximized();
    isMax ? appWindow.unmaximize() : appWindow.maximize();
  };
  const onClose = () => appWindow.close();

  return (
    <div style={{ height: '32px', display: 'flex', alignItems: 'center', background: 'var(--background)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
      {/* Draggable area */}
      <div data-tauri-drag-region style={{ flex: 1, display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '12px', gap: '8px' }}>
        <img src="/icon.png" alt="Nota" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Nota</span>
      </div>

      {/* Buttons area - not draggable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', paddingRight: '8px' }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" style={{ height: '28px', width: '28px' }} onClick={() => setSearchOpen(true)}>
              <Search style={{ height: '14px', width: '14px' }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" style={{ height: '28px', width: '28px' }} onClick={() => setSettingsModalOpen(true)}>
              <Settings style={{ height: '14px', width: '14px' }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />

        <ThemeToggle />

        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />

        <Button variant="ghost" size="icon" style={{ height: '28px', width: '28px' }} onClick={onMinimize}>
          <Minus style={{ height: '14px', width: '14px' }} />
        </Button>
        <Button variant="ghost" size="icon" style={{ height: '28px', width: '28px' }} onClick={onMaximize}>
          <Square style={{ height: '12px', width: '12px' }} />
        </Button>
        <Button variant="ghost" size="icon" style={{ height: '28px', width: '28px' }} onClick={onClose}>
          <X style={{ height: '14px', width: '14px' }} />
        </Button>
      </div>
    </div>
  );
}

function ErrorBanner() {
  const { error, setError } = useSessionStore();

  if (!error) return null;

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setError(null)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AppContent() {
  const { loadSessions } = useSessionStore();
  const { loadSettings } = useSettingsStore();
  const { restore } = useTimerStore();
  const { toggleFocusMode } = useUIStore();

  // Initialize theme
  useTheme();

  // Load data on mount
  useEffect(() => {
    loadSessions();
    loadSettings();
    restore(); // Restore timer state from backend
  }, [loadSessions, loadSettings, restore]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + Shift + F for focus mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleFocusMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex flex-col bg-background">
        {/* Custom Titlebar */}
        <TitleBar />

        {/* Error Banner */}
        <ErrorBanner />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <Workspace />
          <Inspector />
        </div>
      </div>

      {/* Modals */}
      <CreateSessionModal />
      <SettingsModal />
      <FocusMode />
    </TooltipProvider>
  );
}

function App() {
  return <AppContent />;
}

export default App;
