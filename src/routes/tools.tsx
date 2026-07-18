import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore, type ToolCategory } from "@/lib/mock-store";
import { ToolCard } from "@/components/disha/chat-pieces";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShieldAlert, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tool Registry — Disha" },
      { name: "description", content: "Browse and filter AI development tools by category, then generate ready-to-run prompts." },
    ],
  }),
  component: ToolsPage,
});

const categories: (ToolCategory | "All")[] = ["All", "IDE", "Deployment", "Database", "Frontend", "Backend"];

function ToolsPage() {
  const tools = useStore((s) => s.tools);
  const user = useStore((s) => s.user);
  const activeWs = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));

  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [q, setQ] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const approved = useMemo(() => tools.filter((t) => !t.pending), [tools]);
  const pending = useMemo(() => tools.filter((t) => t.pending), [tools]);

  const filtered = useMemo(() => {
    return approved.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (q && !`${t.name} ${t.description}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [approved, category, q]);

  const handleGenerate = async (toolId: string, toolName: string) => {
    if (!activeWs) {
      toast.error("Select a workspace first");
      return;
    }
    setGenerating(toolId);
    try {
      await api.generatePrompt(toolId, activeWs.id, "Cursor");
      toast.success(`Prompt generated — view it in Prompt Library`);
    } catch (err) {
      toast.error("Failed to generate prompt");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <AppShell header={<h1 className="font-display text-base font-semibold">Tool Registry</h1>}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6">
          <h2 className="font-display text-3xl font-bold tracking-tight">AI development tools</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Curated tools Disha can recommend and generate prompts for.
          </p>
        </div>

        <Tabs defaultValue="registry" className="w-full">
          <TabsList>
            <TabsTrigger value="registry">Registry ({approved.length})</TabsTrigger>
            {user.role === "admin" && (
              <TabsTrigger value="pending">
                <ShieldAlert className="mr-1.5 size-3.5" /> Pending Approval ({pending.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="registry" className="mt-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tools..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    category === c
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <ToolCard
                  key={t.id}
                  tool={t}
                  onGenerate={() => handleGenerate(t.id, t.name)}
                  generating={generating === t.id}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No tools match your filters.
              </div>
            )}
          </TabsContent>

          {user.role === "admin" && (
            <TabsContent value="pending" className="mt-6">
              <div className="space-y-3">
                {pending.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div>
                      <div className="font-display font-semibold">{t.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toast.success(`Approved ${t.name}`)}>
                        <Check className="size-4" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast(`Rejected ${t.name}`)}>
                        <X className="size-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}