import { Settings, Search, Menu } from "lucide-react";
import { useUIStore } from "@/stores";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
  const { setSettingsModalOpen, setSearchOpen, toggleSidebar } = useUIStore();

  return (
    <div
      className="h-14 flex items-center justify-between px-4 bg-background border-b shrink-0"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 touch-manipulation"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img
          src="/icon.png"
          alt="Nota"
          className="w-7 h-7 rounded-md"
        />
        <span className="font-semibold text-lg">Nota</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 touch-manipulation"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 touch-manipulation"
          onClick={() => setSettingsModalOpen(true)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
