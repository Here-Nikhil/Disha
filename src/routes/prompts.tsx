import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore, type Platform } from "@/lib/mock-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Copy, Download, Eye, BookText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prompts")({
  head: () => ({
    meta: [
      { title: "Prompt Library — Disha" },
      { name: "description", content: "All prompts generated for your active workspace, ready to copy into your favorite coding agent." },
    ],
  }),
  component: PromptsPage,
});

type PromptResponse = {
  id: string;
  title: string;
  platform: Platform;
  body: string;
  created_at: string;
};

const platforms: (Platform | "All")[] = ["All", "Claude Code", "Cursor", "Lovable", "Replit", "Windsurf", "Bolt"];

const platformColor: Record<Platform, string> = {
  "Claude Code": "text-orange-300 border-orange-500/25 bg-orange-500/10",
  Cursor: "text-sky-300 border-sky-500/25 bg-sky-500/10",
  Lovable: "text-pink-300 border-pink-500/25 bg-pink-500/10",
  Replit: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  Windsurf: "text-violet-300 border-violet-500/25 bg-violet-500/10",
  Bolt: "text-amber-300 border-amber-500/25 bg-amber-500/10",
};

function PromptsPage() {
  const activeWs = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const [platform, setPlatform] = useState<(typeof platforms)[number]>("All");
  const [viewing, setViewing] = useState<PromptResponse | null>(null);
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
  if (!activeWs?.id) return; // wait until workspace is available

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const data = await api.getPrompts(activeWs.id);
      setPrompts(data);
    } catch (err) {
      toast.error("Could not load prompts");
    } finally {
      setLoading(false);
    }
  };

  fetchPrompts();
}, [activeWs?.id]);

  const filtered = useMemo(() => {
    if (platform === "All") return prompts;
    return prompts.filter((p) => p.platform === platform);
  }, [prompts, platform]);

  const handleCopy = (p: PromptResponse) => {
    navigator.clipboard?.writeText(p.body);
    toast.success("Prompt copied to clipboard");
  };

  const handleDownload = (p: PromptResponse) => {
    const blob = new Blob([p.body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Prompt downloaded");
  };

  return (
    <AppShell header={<h1 className="font-display text-base font-semibold">Prompt Library</h1>}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Prompt library</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {activeWs ? <>All prompts generated for <span className="text-foreground">{activeWs.name}</span></> : "Showing all prompts across workspaces"}
            </p>
          </div>
          <div className="w-full sm:w-56">
            <Select value={platform} onValueChange={(v) => setPlatform(v as (typeof platforms)[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">Loading prompts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <BookText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No prompts yet. Generate one from the Tool Registry or chat with Disha.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {filtered.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4 md:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-semibold">{p.title}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${platformColor[p.platform]}`}>
                        {p.platform}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · {p.body.slice(0, 80)}…
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(p)}>
                      <Copy className="size-4" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(p)}>
                      <Download className="size-4" /> Download
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setViewing(p)}>
                      <Eye className="size-4" /> View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>{viewing?.platform} · {viewing && new Date(viewing.created_at).toLocaleString()}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed">
            {viewing?.body}
          </div>
          <div className="flex justify-end gap-2">
            {viewing && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(viewing)}>
                  <Copy className="size-4" /> Copy
                </Button>
                <Button size="sm" onClick={() => handleDownload(viewing)}>
                  <Download className="size-4" /> Download
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}