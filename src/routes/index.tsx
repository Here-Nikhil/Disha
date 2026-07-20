import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TechBadge } from "@/components/disha/chat-pieces";
import { Plus, ArrowRight, ArrowUp, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Disha" },
      { name: "description", content: "Your Disha workspaces and recent architecture planning sessions." },
    ],
  }),
  component: Dashboard,
});

const activityLabel = {
  active: { label: "Active", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
  idle: { label: "Idle", cls: "text-amber-300 bg-amber-500/10 border-amber-500/25" },
  archived: { label: "Archived", cls: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25" },
} as const;

function Dashboard() {
  const workspaces = useStore((s) => s.workspaces);
  const createWorkspace = useStore((s) => s.createWorkspace);
  const navigate = useNavigate();

  const handleCreate = async () => {
    const id = await createWorkspace("New workspace");
    navigate({ to: "/workspace/$id", params: { id } });
  };

  if (workspaces.length === 0) {
    return (
      <AppShell
        header={
          <div className="flex items-center justify-between">
            <h1 className="font-display text-base font-semibold">Dashboard</h1>
          </div>
        }
      >
        <DashboardEmptyState />
      </AppShell>
    );
  }

  return (
    <AppShell
      header={
        <div className="flex items-center justify-between">
          <h1 className="font-display text-base font-semibold">Dashboard</h1>
          <Button onClick={handleCreate} size="sm">
            <Plus className="size-4" /> New Workspace
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">Your workspaces</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pick up where you left off, or start planning a new build.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => {
            const meta = activityLabel[w.activity];
            return (
              <Link
                key={w.id}
                to="/workspace/$id"
                params={{ id: w.id }}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold group-hover:text-primary">{w.name}</h3>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.cls)}>
                    {meta.label}
                  </span>
                </div>
                <div className="mb-3 text-xs text-muted-foreground">
                  Phase: <span className="text-foreground/80">{w.phase}</span>
                </div>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {w.techStack.slice(0, 4).map((t) => (
                    <TechBadge key={t} label={t} />
                  ))}
                  {w.techStack.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">No stack yet</span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" /> {w.messages.length} messages
                  </span>
                  <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

const examplePrompts = [
  "E-commerce platform with React and Node",
  "Mobile app for fitness tracking",
  "SaaS dashboard with multi-tenancy",
];

function DashboardEmptyState() {
  const [value, setValue] = useState("");
  const createWorkspace = useStore((s) => s.createWorkspace);
  const sendMessage = useStore((s) => s.sendMessage);
  const renameWorkspace = useStore((s) => s.renameWorkspace);
  const navigate = useNavigate();

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = await createWorkspace(trimmed.slice(0, 48));
    renameWorkspace(id, trimmed.slice(0, 48));
    sendMessage(id, trimmed);
    navigate({ to: "/workspace/$id", params: { id } });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
        <Sparkles className="size-6" />
      </div>
      <h1 className="text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
        What are you building?
      </h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Describe your idea and Disha will help you map out the architecture, tools, and prompts.
      </p>

      <div className="mt-8 w-full rounded-2xl border border-border bg-card p-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(value);
            }
          }}
          placeholder="Describe your project idea, stack preferences, or paste your requirements..."
          className="min-h-[120px] resize-none border-0 bg-transparent px-3 py-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center justify-between px-1 pt-2">
          <span className="text-[11px] text-muted-foreground">Shift + Enter for new line</span>
          <Button size="sm" onClick={() => handleSubmit(value)} disabled={!value.trim()}>
            Start <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {examplePrompts.map((p) => (
          <button
            key={p}
            onClick={() => setValue(p)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}