import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore, type Phase } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatBubble, ConfidenceRing, TechBadge } from "@/components/disha/chat-pieces";
import { ArrowUp, Mic, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pickTranscribeProvider, transcribeAudio } from "@/lib/transcribe";
import { api } from "@/lib/api";

export const Route = createFileRoute("/workspace/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Workspace — Disha` },
      { name: "description", content: `Architecture planning session ${params.id} in Disha.` },
    ],
  }),
  component: WorkspaceRoute,
  notFoundComponent: () => (
    <AppShell><div className="p-8 text-muted-foreground">Workspace not found.</div></AppShell>
  ),
});

const examplePrompts = [
  "E-commerce platform with React and Node",
  "Mobile app for fitness tracking",
  "SaaS dashboard with multi-tenancy",
];

const phases: Phase[] = ["Requirements", "Architecture", "Tool Selection", "Prompt Generation"];

function stripMarkdown(text: string): string {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#{1,6}\s?/g, "")
    .trim();
}

function WorkspaceRoute() {
  const { id } = Route.useParams();
  const workspace = useStore((s) => s.workspaces.find((w) => w.id === id));
  const setActive = useStore((s) => s.setActiveWorkspace);
  const sendMessage = useStore((s) => s.sendMessage);
  const addPrompt = useStore((s) => s.addPrompt);
  const renameWorkspace = useStore((s) => s.renameWorkspace);
  const navigate = useNavigate();

  const loadMessages = useStore((s) => s.loadMessages);

  useEffect(() => {
    if (workspace) {
      setActive(workspace.id);
      loadMessages(workspace.id);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace) {
      const t = setTimeout(() => navigate({ to: "/" }), 400);
      return () => clearTimeout(t);
    }
  }, [workspace, navigate]);

  if (!workspace) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      header={
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-base font-semibold">{workspace.name}</h1>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {workspace.phase}
          </span>
        </div>
      }
    >
      <ChatView
        workspaceId={workspace.id}
        onSend={(t) => {
          if (workspace.messages.length === 0) {
            renameWorkspace(workspace.id, stripMarkdown(t).slice(0, 48));
          }
          sendMessage(workspace.id, t);
        }}
        onGeneratePrompt={async (toolName) => {
          const tool = useStore.getState().tools.find((t) => t.name === toolName);
          if (!tool) { toast.error("Tool not found"); return; }
          try {
            await api.generatePrompt(tool.id, workspace.id, "Claude Code");
            toast.success(`Prompt generated for ${toolName} — view it in Prompt Library`);
          } catch {
            toast.error("Failed to generate prompt. Check your API key in Settings.");
          }
        }}
      />
    </AppShell>
  );
}

function ChatView({
  workspaceId,
  onSend,
  onGeneratePrompt,
}: {
  workspaceId: string;
  onSend: (t: string) => void;
  onGeneratePrompt: (toolName: string) => void;
}) {
  const workspace = useStore((s) => s.workspaces.find((w) => w.id === workspaceId))!;
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isEmpty = workspace.messages.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [workspace.messages.length, thinking]);

  const lastMsg = workspace.messages[workspace.messages.length - 1];
  useEffect(() => {
    if (thinking && lastMsg?.author === "disha") setThinking(false);
  }, [lastMsg?.id, thinking]);

  const handleSend = (text?: string) => {
    const v = typeof text === "string" ? text.trim() : value.trim();
    if (!v) return;
    onSend(v);
    setValue("");
    setThinking(true);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-w-0">
      <div className="flex min-w-0 flex-1 flex-col lg:flex-[2]">
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {isEmpty ? (
              <EmptyHero onPick={(t) => setValue(t)} />
            ) : (
              workspace.messages.map((m) => (
                <ChatBubble key={m.id} message={m} onGeneratePrompt={onGeneratePrompt} onSend={handleSend} />
              ))
            )}
            {thinking && <ThinkingIndicator />}
          </div>
        </div>
        <div className="border-t border-border p-4 md:px-8">
          <Composer
            value={value}
            onChange={setValue}
            onSend={handleSend}
            placeholder={
              isEmpty
                ? "Describe your project idea, stack preferences, or requirements..."
                : "Ask Disha about your architecture... (Shift+Enter for new line)"
            }
          />
        </div>
      </div>

      <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background/50 p-6 lg:flex">
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Project</div>
          <div className="font-display text-lg font-semibold">{workspace.name}</div>
        </div>
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tech Stack</div>
          <div className="flex flex-wrap gap-1.5">
            {workspace.techStack.length > 0 ? (
              workspace.techStack.map((t) => <TechBadge key={t} label={t} />)
            ) : (
              <span className="text-xs text-muted-foreground">Not yet defined</span>
            )}
          </div>
        </div>
        <div className="mb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Phase</div>
          <div className="flex flex-wrap gap-1.5">
            {phases.map((p) => {
              const active = p === workspace.phase;
              return (
                <span
                  key={p}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {p}
                </span>
              );
            })}
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Confidence Score</div>
          <div className="flex justify-center">
            <ConfidenceRing value={workspace.confidence} />
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Increases as Disha learns about your requirements.
          </p>
        </div>
      </aside>
    </div>
  );
}

function EmptyHero({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
        <Sparkles className="size-6" />
      </div>
      <h1 className="text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
        What are you building?
      </h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Describe your idea and Disha will help you map out the architecture, tools, and prompts.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {examplePrompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text?: string) => void;
  placeholder: string;
}) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(16).fill(0.05));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const apiKeys = useStore((s) => s.apiKeys);
  const voiceProvider = useStore((s) => s.voiceProvider);

  const stopVisualizer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevels(Array(16).fill(0.05));
  };

  const startVisualizer = (stream: MediaStream) => {
    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      const a = analyserRef.current;
      if (!a) return;
      a.getByteFrequencyData(data);
      const bars = 16;
      const step = Math.floor(data.length / bars);
      const next: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j];
        next.push(Math.min(1, sum / step / 180 + 0.05));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const runTranscription = async (blob: Blob) => {
    const provider = pickTranscribeProvider(apiKeys, voiceProvider);
    if (!provider) {
      toast.error("Please add a Groq, OpenAI, or Google API key in Settings to use voice input.");
      return;
    }
    setTranscribing(true);
    try {
      const rawKey = sessionStorage.getItem(`apikey_${provider}`) || apiKeys[provider].value;
      const text = await transcribeAudio(blob, provider, rawKey);
      if (text) onChange(value ? `${value} ${text}` : text);
      else toast.message("No speech detected.");
    } catch {
      toast.error(`Transcription failed via ${provider}. Check your API key.`);
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMic = async () => {
    if (typeof window === "undefined") return;
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    const provider = pickTranscribeProvider(apiKeys, voiceProvider);
    if (!provider) {
      toast.error("Please add a Groq, OpenAI, or Google API key in Settings to use voice input.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Microphone recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopVisualizer();
        setListening(false);
        if (blob.size > 0) await runTranscription(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startVisualizer(stream);
      setListening(true);
    } catch {
      toast.error("Microphone permission denied.");
      stopVisualizer();
    }
  };

  useEffect(() => () => stopVisualizer(), []);

  return (
    <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-card p-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder={placeholder}
        className="min-h-[40px] max-h-40 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
        size={listening ? "default" : "icon"}
        variant={listening ? "default" : "ghost"}
        onClick={toggleMic}
        disabled={transcribing}
        className={cn(
          listening && "bg-primary text-primary-foreground hover:bg-primary/90 px-3 gap-2",
        )}
        aria-label={listening ? "Stop recording" : "Start voice input"}
        title={listening ? "Stop recording" : "Voice input"}
      >
        {listening ? (
          <>
            <Waveform levels={levels} />
            <Square className="size-3 fill-current" />
          </>
        ) : transcribing ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Mic className="size-4" />
        )}
      </Button>
      <Button size="icon" onClick={() => onSend()} disabled={!value.trim()}>
        <ArrowUp className="size-4" />
      </Button>
    </div>
  );
}

function Waveform({ levels }: { levels: number[] }) {
  return (
    <span className="flex h-5 items-center gap-[2px]">
      {levels.map((v, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-primary-foreground/90"
          style={{ height: `${Math.max(10, v * 100)}%`, transition: "height 60ms linear" }}
        />
      ))}
    </span>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-disha/15 text-disha ring-1 ring-disha/30 animate-pulse">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 border-l-2 border-disha/70 pl-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-disha">Disha</div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-disha animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-disha animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-disha animate-bounce" />
          </span>
          <span>Disha is thinking...</span>
        </div>
      </div>
    </div>
  );
}