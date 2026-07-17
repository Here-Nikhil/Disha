import { cn } from "@/lib/utils";
import type { ChatMessage, Tool, ToolCategory } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Sparkles } from "lucide-react";

const categoryColor: Record<ToolCategory, string> = {
  IDE: "bg-violet-500/12 text-violet-300 border-violet-500/25",
  Deployment: "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
  Database: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  Frontend: "bg-indigo-500/12 text-indigo-300 border-indigo-500/25",
  Backend: "bg-amber-500/12 text-amber-300 border-amber-500/25",
};

export function CategoryPill({ category, className }: { category: ToolCategory; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        categoryColor[category],
        className,
      )}
    >
      {category}
    </span>
  );
}

export function FreePaidBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        paid
          ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      )}
    >
      {paid ? "Paid" : "Free"}
    </span>
  );
}

export function TechBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground/85">
      {label}
    </span>
  );
}

export function ChatBubble({ message, onGeneratePrompt }: { message: ChatMessage; onGeneratePrompt?: (toolName: string) => void }) {
  const isUser = message.author === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-disha/15 text-disha ring-1 ring-disha/30">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-disha/70 pl-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-disha">Disha</div>
        <p className="text-sm leading-relaxed text-foreground/90">{message.content}</p>

        {message.kind === "tool" && (message.tools?.length || message.tool) && (
          <div className="mt-4 space-y-3">
            {(message.tools ?? (message.tool ? [message.tool] : [])).map((t, i) => (
              <ToolRecommendationCard
                key={`${t.name}-${i}`}
                tool={t}
                onGenerate={() => onGeneratePrompt?.(t.name)}
              />
            ))}
          </div>
        )}

        {message.kind === "consensus" && message.consensus && (
          <ConsensusCard data={message.consensus} />
        )}
      </div>
    </div>
  );
}

export function ToolRecommendationCard({
  tool,
  onGenerate,
}: {
  tool: { name: string; description: string; paid: boolean; category: ToolCategory };
  onGenerate?: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-semibold">{tool.name}</h4>
            <CategoryPill category={tool.category} />
            <FreePaidBadge paid={tool.paid} />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onGenerate}>View Prompt</Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground">
          <ExternalLink className="size-3.5" />
          Docs
        </Button>
      </div>
    </div>
  );
}

export function ConsensusCard({
  data,
}: {
  data: { options: { model: string; recommendation: string }[]; finalIndex: number; summary: string };
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Model Consensus
        </div>
        <span className="text-[10px] font-medium text-cyan-accent">
          {data.options.length} models polled
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {data.options.map((opt, i) => {
          const winner = i === data.finalIndex;
          return (
            <div
              key={opt.model}
              className={cn(
                "relative rounded-lg border p-3 text-xs",
                winner
                  ? "border-primary/60 bg-primary/8 ring-1 ring-primary/40"
                  : "border-border bg-background/50 opacity-70",
              )}
            >
              {winner && (
                <span className="absolute -top-2 right-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Pick
                </span>
              )}
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {opt.model}
              </div>
              <div className="text-foreground/90">{opt.recommendation}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{data.summary}</p>
    </div>
  );
}

export function ConfidenceRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative grid size-32 place-items-center">
      <svg className="size-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} strokeWidth="7" className="fill-none stroke-border" />
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="7"
          strokeLinecap="round"
          className="fill-none stroke-primary transition-all duration-500"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold leading-none">{clamped}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confidence</span>
      </div>
    </div>
  );
}

export function ToolCard({ tool, onGenerate }: { tool: Tool; onGenerate: () => void }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">{tool.name}</h3>
            <a href={tool.url} className="text-muted-foreground hover:text-foreground" aria-label="Open docs">
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <CategoryPill category={tool.category} />
            <FreePaidBadge paid={tool.paid} />
          </div>
        </div>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
      <Button size="sm" className="mt-4 self-start" onClick={onGenerate}>Generate Prompt</Button>
    </div>
  );
}
