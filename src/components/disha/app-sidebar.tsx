import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { useStore } from "@/lib/mock-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Wrench,
  BookText,
  Settings,
  Plus,
  Menu,
  Sparkles,
  Settings2,
  ShieldCheck,
} from "lucide-react";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 7l3.5 4M17 7l-3.5 4M7 17l3.5-4M17 17l-3.5-4" />
    </svg>
  );
}

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tools", label: "Tool Registry", icon: Wrench },
  { to: "/prompts", label: "Prompt Library", icon: BookText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const adminLink = { to: "/admin", label: "Admin", icon: ShieldCheck } as const;

const activityDot = {
  active: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  idle: "bg-amber-400",
  archived: "bg-zinc-500",
};

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const workspaces = useStore((s) => s.workspaces);
  const activeId = useStore((s) => s.activeWorkspaceId);
  const setActive = useStore((s) => s.setActiveWorkspace);
  const createWorkspace = useStore((s) => s.createWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const mockUser = useStore((s) => s.user);
  const { user } = useUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || mockUser.name;
  const displayEmail = user?.primaryEmailAddress?.emailAddress || mockUser.email;
  const isAdmin = user?.publicMetadata?.role === "admin";

  const handleNew = async () => {
    const id = await createWorkspace("New workspace");
    navigate({ to: "/workspace/$id", params: { id } });
    onNavigate?.();
  };

  const handleSwitch = (id: string) => {
    setActive(id);
    navigate({ to: "/workspace/$id", params: { id } });
    onNavigate?.();
  };

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
          <LogoMark className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold leading-none tracking-tight">Disha</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Architecture AI</div>
        </div>
      </div>

      {/* New workspace */}
      <div className="px-3 pb-4">
        <Button onClick={handleNew} className="w-full justify-start gap-2 rounded-lg" size="sm">
          <Plus className="size-4" />
          New Workspace
        </Button>
      </div>

      {/* Workspaces */}
      <div className="px-3 pb-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspaces</div>
        <div className="space-y-0.5">
          {workspaces.map((w) => {
            const isActive = w.id === activeId && pathname.startsWith("/workspace");
            return (
              <button
                key={w.id}
                onClick={() => handleSwitch(w.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", activityDot[w.activity])} />
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${w.name}"? This cannot be undone.`)) {
                      deleteWorkspace(w.id);
                      navigate({ to: "/" });
                    }
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}
          {workspaces.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No workspaces yet.</div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigate</div>
        <div className="space-y-0.5">
          {[...navLinks, ...(isAdmin ? [adminLink] : [])].map((l) => {
            const active =
              l.to === "/"
                ? pathname === "/"
                : pathname === l.to || pathname.startsWith(l.to + "/");
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex-1" />

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border overflow-hidden">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={displayName} className="size-8 rounded-full object-cover" />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{displayEmail}</div>
          </div>
          <Link
            to="/settings"
            onClick={onNavigate}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
            aria-label="Settings"
          >
            <Settings2 className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden h-screen w-[260px] shrink-0 border-r border-border md:block">
      <SidebarInner />
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarInner onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}