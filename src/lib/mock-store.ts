import { create } from "zustand";
import { api } from "./api";

export type Platform =
  | "Claude Code"
  | "Cursor"
  | "Lovable"
  | "Replit"
  | "Windsurf"
  | "Bolt";

export type ToolCategory =
  | "IDE"
  | "Deployment"
  | "Database"
  | "Frontend"
  | "Backend";

export type Phase =
  | "Requirements"
  | "Architecture"
  | "Tool Selection"
  | "Prompt Generation";

export type MessageKind = "text" | "tool" | "consensus" | "prompt";

export type ToolRec = {
  name: string;
  description: string;
  paid: boolean;
  category: ToolCategory;
  best_for?: string;
  pros?: string[];
  cons?: string[];
};

export type ChatMessage = {
  id: string;
  author: "user" | "disha";
  kind: MessageKind;
  content: string;
  tool?: ToolRec;
  tools?: ToolRec[];
  consensus?: {
    options: { model: string; recommendation: string }[];
    finalIndex: number;
    summary: string;
  };
  generated_prompt?: {
    title: string;
    platform: string;
    body: string;
  };
  createdAt: number;
};

export type Prompt = {
  id: string;
  title: string;
  platform: Platform;
  body: string;
  createdAt: number;
};

export type Workspace = {
  id: string;
  name: string;
  activity: "active" | "idle" | "archived";
  techStack: string[];
  phase: Phase;
  confidence: number;
  messages: ChatMessage[];
  prompts: Prompt[];
  defaultModel: string;
};

export type Tool = {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  paid: boolean;
  url: string;
  pending?: boolean;
};

export type ApiProvider = "OpenAI" | "Anthropic" | "Google" | "OpenRouter" | "Groq" | "DeepSeek";
export type ApiKeyStatus = "unset" | "valid" | "invalid";
export type VoiceProvider = "Groq" | "OpenAI" | "Google";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "suspended";
  joinedAt: number;
};

type State = {
  user: { name: string; email: string; role: "admin" | "user"; provider: string };
  workspaces: Workspace[];
  activeWorkspaceId: string;
  tools: Tool[];
  apiKeys: Record<ApiProvider, { value: string; status: ApiKeyStatus }>;
  useAccountKeys: boolean;
  voiceProvider: VoiceProvider | "auto";
  adminUsers: AdminUser[];

  createWorkspace: (name?: string) => Promise<string>;
  setActiveWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => Promise<void>;
  setDefaultModel: (id: string, model: string) => void;
  sendMessage: (workspaceId: string, text: string) => void;
  addPrompt: (workspaceId: string, prompt: Omit<Prompt, "id" | "createdAt">) => void;
  saveApiKey: (provider: ApiProvider, value: string) => void;
  setUseAccountKeys: (v: boolean) => void;
  setVoiceProvider: (v: VoiceProvider | "auto") => void;
  approveTool: (id: string) => void;
  rejectTool: (id: string) => void;
  suspendUser: (id: string) => void;
  activateUser: (id: string) => void;
  deleteUser: (id: string) => void;
  updateUserName: (name: string) => void;
  loadMessages: (workspaceId: string) => Promise<void>;
  loadWorkspaces: () => Promise<void>;
  loadTools: () => Promise<void>;
  loadApiKeys: () => Promise<void>;
  loadUser: () => Promise<void>;
};

let _uidCounter = 0;
const uid = () => `id${(++_uidCounter).toString(36)}`;

const seedTools: Tool[] = [
  { id: uid(), name: "Cursor", category: "IDE", description: "AI-first code editor with deep repo understanding.", paid: true, url: "#" },
  { id: uid(), name: "Claude Code", category: "IDE", description: "Terminal-native coding agent by Anthropic.", paid: true, url: "#" },
  { id: uid(), name: "Windsurf", category: "IDE", description: "Agentic IDE with cascading edits across the codebase.", paid: false, url: "#" },
  { id: uid(), name: "Vercel", category: "Deployment", description: "Zero-config deployment for frontend frameworks.", paid: false, url: "#" },
  { id: uid(), name: "Fly.io", category: "Deployment", description: "Run full-stack apps close to your users worldwide.", paid: true, url: "#" },
  { id: uid(), name: "Cloudflare Workers", category: "Deployment", description: "Serverless edge functions on 300+ POPs.", paid: false, url: "#" },
  { id: uid(), name: "Supabase", category: "Database", description: "Postgres, auth, storage, realtime in one platform.", paid: false, url: "#" },
  { id: uid(), name: "Neon", category: "Database", description: "Serverless Postgres with branching.", paid: false, url: "#" },
  { id: uid(), name: "PlanetScale", category: "Database", description: "MySQL with schema branching and horizontal scale.", paid: true, url: "#" },
  { id: uid(), name: "Next.js", category: "Frontend", description: "React framework with SSR, RSC, and file routing.", paid: false, url: "#" },
  { id: uid(), name: "TanStack Start", category: "Frontend", description: "Full-stack React with typed routing and server fns.", paid: false, url: "#" },
  { id: uid(), name: "Astro", category: "Frontend", description: "Content-focused framework with islands architecture.", paid: false, url: "#" },
  { id: uid(), name: "Hono", category: "Backend", description: "Ultrafast web framework for edges and Node.", paid: false, url: "#" },
  { id: uid(), name: "tRPC", category: "Backend", description: "End-to-end typesafe APIs without codegen.", paid: false, url: "#" },
  { id: uid(), name: "Inngest", category: "Backend", description: "Durable event-driven workflows and background jobs.", paid: true, url: "#" },
  { id: uid(), name: "Resend", category: "Backend", description: "Modern email API for developers.", paid: true, url: "#" },
  { id: uid(), name: "Convex", category: "Database", description: "Reactive database with typed queries and mutations.", paid: true, url: "#", pending: true },
  { id: uid(), name: "Zed", category: "IDE", description: "High-performance collaborative editor with AI.", paid: false, url: "#", pending: true },
];

export const useStore = create<State>((set, get) => ({
  user: { name: "", email: "", role: "user", provider: "clerk" },
  workspaces: [],
  activeWorkspaceId: "",
  tools: seedTools,
  apiKeys: {
    OpenAI: { value: "", status: "unset" },
    Anthropic: { value: "", status: "unset" },
    Google: { value: "", status: "unset" },
    OpenRouter: { value: "", status: "unset" },
    Groq: { value: "", status: "unset" },
    DeepSeek: { value: "", status: "unset" },
  },
  useAccountKeys: true,
  voiceProvider: "auto",
  adminUsers: [],

  setVoiceProvider: (v) => set({ voiceProvider: v }),
  approveTool: (id) => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, pending: false } : t)) })),
  rejectTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
  suspendUser: (id) => set((s) => ({ adminUsers: s.adminUsers.map((u) => (u.id === id ? { ...u, status: "suspended" } : u)) })),
  activateUser: (id) => set((s) => ({ adminUsers: s.adminUsers.map((u) => (u.id === id ? { ...u, status: "active" } : u)) })),
  deleteUser: (id) => set((s) => ({ adminUsers: s.adminUsers.filter((u) => u.id !== id) })),

  loadMessages: async (workspaceId: string) => {
    try {
      const data = await api.getMessages(workspaceId);
      const messages = (data || []).map((m: any) => ({
        id: m.id,
        author: m.author as "user" | "disha",
        kind: m.kind as MessageKind,
        content: m.content,
        tool: m.tool || undefined,
        tools: m.tools || undefined,
        consensus: m.consensus
          ? {
              options: m.consensus.options,
              finalIndex: m.consensus.final_index,
              summary: m.consensus.summary,
            }
          : undefined,
        generated_prompt: m.generated_prompt || undefined,
        createdAt: new Date(m.created_at).getTime(),
      }));
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, messages } : w,
        ),
      }));
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  },

  loadWorkspaces: async () => {
    try {
      const data = await api.getWorkspaces();
      const mapped: Workspace[] = (data || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        activity: "active",
        techStack: w.tech_stack || [],
        phase: w.phase || "Requirements",
        confidence: w.confidence || 0,
        messages: [],
        prompts: [],
        defaultModel: "llama-3.3-70b",
      }));
      set({ workspaces: mapped, activeWorkspaceId: mapped[0]?.id ?? "" });
    } catch (e) {
      console.error("Failed to load workspaces", e);
    }
  },

  loadTools: async () => {
    try {
      const data = await api.getTools();
      const mapped: Tool[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category as ToolCategory,
        description: t.description,
        paid: t.paid,
        url: t.url || "#",
        pending: false,
      }));
      set({ tools: mapped });
    } catch (e) {
      console.error("Failed to load tools", e);
    }
  },

  loadApiKeys: async () => {
    try {
      const data = await api.getApiKeys();
      const updates: Partial<Record<ApiProvider, { value: string; status: ApiKeyStatus }>> = {};
      for (const item of data) {
        if (item.masked_key) {
          updates[item.provider as ApiProvider] = { value: item.masked_key, status: item.status as ApiKeyStatus };
        }
      }
      set((s) => ({ apiKeys: { ...s.apiKeys, ...updates } }));
    } catch (e) {
      console.error("Failed to load api keys", e);
    }
  },

  loadUser: async () => {
    try {
      const data = await api.getCurrentUser();
      set((s) => ({ user: { ...s.user, name: data.name, email: data.email, role: data.role } }));
    } catch (e) {
      console.error("Failed to load user", e);
    }
  },

  createWorkspace: async (name) => {
    try {
      const data = await api.createWorkspace(name || "Untitled workspace");
      const ws: Workspace = {
        id: data.id,
        name: data.name,
        activity: "active",
        techStack: [],
        phase: "Requirements",
        confidence: 0,
        messages: [],
        prompts: [],
        defaultModel: "llama-3.3-70b",
      };
      set((s) => ({ workspaces: [ws, ...s.workspaces], activeWorkspaceId: ws.id }));
      return ws.id;
    } catch (e) {
      const id = uid();
      const ws: Workspace = {
        id,
        name: name || "Untitled workspace",
        activity: "active",
        techStack: [],
        phase: "Requirements",
        confidence: 0,
        messages: [],
        prompts: [],
        defaultModel: "llama-3.3-70b",
      };
      set((s) => ({ workspaces: [ws, ...s.workspaces], activeWorkspaceId: id }));
      return id;
    }
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  renameWorkspace: (id, name) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
    })),

  deleteWorkspace: async (id) => {
    try {
      await api.deleteWorkspace(id);
    } catch (e) {
      console.error("Failed to delete workspace on backend", e);
    }
    set((s) => {
      const remaining = s.workspaces.filter((w) => w.id !== id);
      return {
        workspaces: remaining,
        activeWorkspaceId:
          s.activeWorkspaceId === id ? remaining[0]?.id ?? "" : s.activeWorkspaceId,
      };
    });
  },

  setDefaultModel: (id, model) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, defaultModel: model } : w)),
    })),

  sendMessage: (workspaceId, text) => {
    const userMsg: ChatMessage = {
      id: uid(),
      author: "user",
      kind: "text",
      content: text,
      createdAt: Date.now(),
    };
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, messages: [...w.messages, userMsg] } : w,
      ),
    }));
    api.sendMessage(workspaceId, text)
      .then((reply: any) => {
        const msg = reply.assistant_message || reply;

        // Normalize nulls to undefined
        const generatedPrompt = msg.generated_prompt || undefined;
        const consensus = msg.consensus || undefined;
        const toolsArr: ToolRec[] | undefined =
          Array.isArray(msg.tools) && msg.tools.length > 0
            ? msg.tools
            : msg.tool
            ? [msg.tool]
            : undefined;

        // Determine kind — check generated_prompt first, before tools
        let kind: MessageKind = "text";
        if (generatedPrompt) kind = "prompt";
        else if (consensus) kind = "consensus";
        else if (toolsArr) kind = "tool";

        const dishaMsg: ChatMessage = {
          id: uid(),
          author: "disha",
          kind,
          content: msg.content || "Here's my recommendation.",
          tool: toolsArr?.[0],
          tools: toolsArr,
          consensus,
          generated_prompt: generatedPrompt,
          createdAt: Date.now(),
        };

        const wsPatch = reply.workspace
          ? {
              techStack: reply.workspace.tech_stack ?? undefined,
              phase: reply.workspace.phase ?? undefined,
              confidence:
                typeof reply.workspace.confidence === "number"
                  ? reply.workspace.confidence
                  : undefined,
            }
          : {};

        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  messages: [...w.messages, dishaMsg],
                  techStack: wsPatch.techStack ?? w.techStack,
                  phase: wsPatch.phase ?? w.phase,
                  confidence: wsPatch.confidence ?? Math.min(100, w.confidence + 6),
                }
              : w,
          ),
        }));
      })
      .catch(() => {
        const dishaMsg: ChatMessage = {
          id: uid(),
          author: "disha",
          kind: "text",
          content: `**No AI provider configured.**\n\nGo to [Settings](/settings) and add a Groq, OpenAI, Anthropic, or Google API key to get started.`,
          createdAt: Date.now(),
        };
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, messages: [...w.messages, dishaMsg] } : w,
          ),
        }));
      });
  },

  addPrompt: (workspaceId, prompt) => {
    const full: Prompt = { ...prompt, id: uid(), createdAt: Date.now() };
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, prompts: [full, ...w.prompts] } : w,
      ),
    }));
  },

  saveApiKey: (provider, value) => {
    const status: ApiKeyStatus =
      value.length === 0 ? "unset" : value.length > 20 ? "valid" : "invalid";
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: { value, status } } }));
    if (value) sessionStorage.setItem(`apikey_${provider}`, value);
    else sessionStorage.removeItem(`apikey_${provider}`);
    api.saveApiKey(provider, value).catch(() => {});
  },

  setUseAccountKeys: (v) => set({ useAccountKeys: v }),

  updateUserName: (name) => set((s) => ({ user: { ...s.user, name } })),
}));

export function useActiveWorkspace() {
  return useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
}