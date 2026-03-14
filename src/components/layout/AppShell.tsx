import { cn } from "@/lib/utils";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { Inspector } from "./Inspector";

interface AppShellProps {
  className?: string;
}

export function AppShell({ className }: AppShellProps) {
  return (
    <div
      className={cn(
        "h-screen w-screen flex flex-col bg-background overflow-hidden",
        className
      )}
    >
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <Workspace />
        <Inspector />
      </div>
    </div>
  );
}
