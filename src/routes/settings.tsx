import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore, type ApiProvider } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Disha" },
      { name: "description", content: "Manage API keys, workspace preferences, and your Disha profile." },
    ],
  }),
  component: SettingsPage,
});

const providers: ApiProvider[] = ["Groq", "OpenAI", "Anthropic", "Google", "OpenRouter"];
const models = ["llama-3.3-70b", "claude-3.5-sonnet", "gpt-4o", "gemini-1.5-pro"];

function SettingsPage() {
  return (
    <AppShell header={<h1 className="font-display text-base font-semibold">Settings</h1>}>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <ApiKeysSection />
        <VoiceInputSection />
        <WorkspaceSection />
        <ProfileSection />
      </div>
    </AppShell>
  );
}

function VoiceInputSection() {
  const apiKeys = useStore((s) => s.apiKeys);
  const voiceProvider = useStore((s) => s.voiceProvider);
  const setVoiceProvider = useStore((s) => s.setVoiceProvider);
  const configured = (["Groq", "OpenAI", "Google"] as const).filter((p) => apiKeys[p]?.value?.trim());

  return (
    <SectionCard
      title="Voice Input"
      description="Choose which transcription provider to use for the microphone in chat."
    >
      {configured.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          No transcription-capable keys configured. Add a Groq, OpenAI, or Google key above to enable voice input.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-sm">Preferred provider</Label>
          <Select
            value={voiceProvider}
            onValueChange={(v) => {
              setVoiceProvider(v as any);
              toast.success(`Voice provider set to ${v === "auto" ? "Auto" : v}`);
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Groq → OpenAI → Google)</SelectItem>
              {configured.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Groq uses whisper-large-v3-turbo. OpenAI uses whisper-1. Google uses Cloud Speech-to-Text.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ApiKeysSection() {
  const apiKeys = useStore((s) => s.apiKeys);
  const saveApiKey = useStore((s) => s.saveApiKey);
  const useAccountKeys = useStore((s) => s.useAccountKeys);
  const setUseAccountKeys = useStore((s) => s.setUseAccountKeys);
  const [drafts, setDrafts] = useState<Record<ApiProvider, string>>(
    Object.fromEntries(providers.map((p) => [p, apiKeys[p]?.value ?? ""])) as Record<ApiProvider, string>,
  );

  return (
    <SectionCard title="API Keys" description="Bring your own keys. Disha routes chat requests through your provider of choice.">
      <div className="mb-5 flex items-center justify-between rounded-lg border border-border bg-background p-3">
        <div>
          <Label className="text-sm">Use account-level keys for all workspaces</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {useAccountKeys ? "One set of keys applies everywhere." : "Configure per workspace."}
          </p>
        </div>
        <Switch checked={useAccountKeys} onCheckedChange={setUseAccountKeys} />
      </div>

      <div className="space-y-3">
        {providers.map((p) => {
          const entry = apiKeys[p];
          const dot =
            entry?.status === "valid"
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              : entry?.status === "invalid"
                ? "bg-red-400"
                : "bg-zinc-500";
          return (
            <div key={p} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-[110px] items-center gap-2">
                <span className={cn("size-2 rounded-full", dot)} />
                <Label className="text-sm">{p}</Label>
              </div>
              <Input
                type="password"
                value={drafts[p] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
                placeholder={entry?.value ? "••••••••••••••••" : "paste your key..."}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  saveApiKey(p, drafts[p] ?? "");
                  toast.success(`${p} key saved`);
                }}
              >
                <Save className="size-4" /> Save
              </Button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function WorkspaceSection() {
  const activeWs = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const renameWorkspace = useStore((s) => s.renameWorkspace);
  const setDefaultModel = useStore((s) => s.setDefaultModel);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const navigate = useNavigate();
  const [name, setName] = useState(activeWs?.name ?? "");

  if (!activeWs) {
    return <SectionCard title="Workspace"><p className="text-sm text-muted-foreground">No workspace selected.</p></SectionCard>;
  }

  return (
    <SectionCard title="Workspace" description={`Preferences for ${activeWs.name}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Workspace name</Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                renameWorkspace(activeWs.id, name);
                toast.success("Workspace renamed");
              }}
            >
              <Save className="size-4" /> Save
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Default AI model</Label>
          <Select
            value={activeWs.defaultModel}
            onValueChange={(v) => {
              setDefaultModel(activeWs.id, v);
              toast.success(`Default model set to ${v}`);
            }}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3">
          <div>
            <div className="text-sm font-medium">Delete workspace</div>
            <p className="text-xs text-muted-foreground">This can't be undone.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-destructive/15 hover:text-red-300">
                <Trash2 className="size-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  {activeWs.name} and all its messages and prompts will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    deleteWorkspace(activeWs.id);
                    toast.success("Workspace deleted");
                    navigate({ to: "/" });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SectionCard>
  );
}

function ProfileSection() {
  const user = useStore((s) => s.user);
  const updateUserName = useStore((s) => s.updateUserName);
  const [name, setName] = useState(user.name);

  return (
    <SectionCard title="Profile" description="Your account information.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Display name</Label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                updateUserName(name);
                toast.success("Profile updated");
              }}
            >
              <Save className="size-4" /> Save
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Email</Label>
          <Input value={user.email} readOnly className="text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Connected auth provider</Label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="size-2 rounded-full bg-emerald-400" />
            {user.provider}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}