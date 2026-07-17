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

export type MessageKind = "text" | "tool" | "consensus";

export type ChatMessage = {
  id: string;
  author: "user" | "disha";
  kind: MessageKind;
  content: string;
  tool?: {
    name: string;
    description: string;
    paid: boolean;
    category: ToolCategory;
  };
  consensus?: {
    options: { model: string; recommendation: string }[];
    finalIndex: number;
    summary: string;
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

export type ApiProvider = "OpenAI" | "Anthropic" | "Google" | "OpenRouter" | "Groq";
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
  deleteWorkspace: (id: string) => void;
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
  loadWorkspaces: () => Promise<void>;
};

let _uidCounter = 0;
const uid = () => `id${(++_uidCounter).toString(36)}`;
const BASE_TS = 1735689600000;

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

function seedWorkspaceA(): Workspace {
  const now = BASE_TS;
  return {
    id: uid(),
    name: "SaaS Analytics Platform",
    activity: "active",
    techStack: ["TanStack Start", "Postgres", "Supabase", "Tailwind"],
    phase: "Architecture",
    confidence: 82,
    defaultModel: "llama-3.3-70b",
    messages: [
      { id: uid(), author: "user", kind: "text", content: "I'm building a multi-tenant SaaS dashboard for product analytics. Need auth, orgs, and time-series data.", createdAt: now - 600000 },
      { id: uid(), author: "disha", kind: "text", content: "Great — for multi-tenant SaaS with time-series analytics, I'd lead with Supabase for auth + Postgres, and add TimescaleDB extension for the analytics tables. Row-level security handles tenant isolation cleanly.", createdAt: now - 590000 },
      { id: uid(), author: "disha", kind: "tool", content: "Recommended tool for auth and data layer:", tool: { name: "Supabase", description: "Postgres + auth + RLS + realtime in one platform. Perfect for multi-tenant SaaS.", paid: false, category: "Database" }, createdAt: now - 580000 },
      { id: uid(), author: "user", kind: "text", content: "What about the deployment story?", createdAt: now - 500000 },
      { id: uid(), author: "disha", kind: "consensus", content: "I polled three models on the deployment choice:", consensus: {
        options: [
          { model: "GPT-4o", recommendation: "Vercel — fastest DX for Next-adjacent stacks." },
          { model: "Claude 3.5", recommendation: "Cloudflare Workers — global edge, cheap at scale." },
          { model: "Gemini 1.5", recommendation: "Fly.io — regional Postgres proximity." },
        ],
        finalIndex: 1,
        summary: "Cloudflare Workers wins on cost-at-scale and global latency, and TanStack Start deploys cleanly to it.",
      }, createdAt: now - 490000 },
    ],
    prompts: [
      { id: uid(), title: "Supabase multi-tenant schema", platform: "Claude Code", body: "Design a Supabase schema...", createdAt: now - 400000 },
      { id: uid(), title: "TanStack Start + CF Workers deploy", platform: "Cursor", body: "Configure a TanStack Start app...", createdAt: now - 300000 },
      { id: uid(), title: "Analytics dashboard shell UI", platform: "Lovable", body: "Build a responsive analytics dashboard...", createdAt: now - 200000 },
      { id: uid(), title: "Time-series ingestion worker", platform: "Bolt", body: "Scaffold a Cloudflare Worker...", createdAt: now - 100000 },
    ],
  };
}

function seedWorkspaceB(): Workspace {
  const now = BASE_TS;
  return {
    id: uid(),
    name: "Fitness Tracker Mobile",
    activity: "idle",
    techStack: ["React Native", "Expo", "SQLite"],
    phase: "Requirements",
    confidence: 41,
    defaultModel: "llama-3.3-70b",
    messages: [
      { id: uid(), author: "user", kind: "text", content: "Cross-platform fitness app, offline-first, syncs to cloud when online.", createdAt: now - 200000 },
      { id: uid(), author: "disha", kind: "text", content: "Offline-first is the right instinct. Let's nail down: (1) which workouts you'll track, (2) sync conflict strategy, (3) whether wearables integration is v1 or v2.", createdAt: now - 190000 },
    ],
    prompts: [],
  };
}

function seedWorkspaceC(): Workspace {
  return {
    id: uid(),
    name: "Internal Design Ops Tool",
    activity: "archived",
    techStack: ["Astro", "SQLite"],
    phase: "Prompt Generation",
    confidence: 96,
    defaultModel: "llama-3.3-70b",
    messages: [],
    prompts: [
      { id: uid(), title: "Astro content collections setup", platform: "Lovable", body: "Set up Astro content collections...", createdAt: BASE_TS - 1000000 },
    ],
  };
}

const wsA = seedWorkspaceA();
const wsB = seedWorkspaceB();
const wsC = seedWorkspaceC();

export const useStore = create<State>((set, get) => ({
  user: { name: "Aarav Sharma", email: "aarav@disha.dev", role: "admin", provider: "GitHub" },
  workspaces: [wsA, wsB, wsC],
  activeWorkspaceId: wsA.id,
  tools: seedTools,
  apiKeys: {
    OpenAI: { value: "", status: "unset" },
    Anthropic: { value: "", status: "unset" },
    Google: { value: "", status: "unset" },
    OpenRouter: { value: "", status: "unset" },
    Groq: { value: "", status: "unset" },
  },
  useAccountKeys: true,
  voiceProvider: "auto",
  adminUsers: [
    { id: uid(), name: "Aarav Sharma", email: "aarav@disha.dev", role: "admin", status: "active", joinedAt: BASE_TS - 30 * 86400000 },
    { id: uid(), name: "Priya Menon", email: "priya@acme.co", role: "user", status: "active", joinedAt: BASE_TS - 12 * 86400000 },
    { id: uid(), name: "Liam O'Connor", email: "liam@northbeam.dev", role: "user", status: "active", joinedAt: BASE_TS - 5 * 86400000 },
    { id: uid(), name: "Yuki Tanaka", email: "yuki@studio.jp", role: "user", status: "suspended", joinedAt: BASE_TS - 2 * 86400000 },
  ],

  setVoiceProvider: (v) => set({ voiceProvider: v }),
  approveTool: (id) => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, pending: false } : t)) })),
  rejectTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
  suspendUser: (id) => set((s) => ({ adminUsers: s.adminUsers.map((u) => (u.id === id ? { ...u, status: "suspended" } : u)) })),
  activateUser: (id) => set((s) => ({ adminUsers: s.adminUsers.map((u) => (u.id === id ? { ...u, status: "active" } : u)) })),
  deleteUser: (id) => set((s) => ({ adminUsers: s.adminUsers.filter((u) => u.id !== id) })),

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
      console.log("Backend unavailable, using mock data");
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

  deleteWorkspace: (id) =>
    set((s) => {
      const remaining = s.workspaces.filter((w) => w.id !== id);
      return {
        workspaces: remaining,
        activeWorkspaceId:
          s.activeWorkspaceId === id ? remaining[0]?.id ?? "" : s.activeWorkspaceId,
      };
    }),

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
        w.id === workspaceId
          ? { ...w, messages: [...w.messages, userMsg] }
          : w,
      ),
    }));
    api.sendMessage(workspaceId, text)
      .then((reply: any) => {
        const msg = reply.assistant_message || reply;
        const dishaMsg: ChatMessage = {
          id: uid(),
          author: "disha",
          kind: msg.consensus ? "consensus" : msg.tool ? "tool" : "text",
          content: msg.content || "Here's my recommendation.",
          tool: msg.tool,
          consensus: msg.consensus,
          createdAt: Date.now(),
        };
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, messages: [...w.messages, dishaMsg], confidence: Math.min(100, w.confidence + 6) }
              : w,
          ),
        }));
      })
      .catch(() => {
        const dishaMsg: ChatMessage = {
          id: uid(),
          author: "disha",
          kind: "text",
          content: `Good question. Given "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}", I'd start by defining the data boundaries before locking in tools.`,
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
      value.length === 0 ? "unset" : value.startsWith("sk-") || value.length > 20 ? "valid" : "invalid";
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: { value, status } } }));
    api.saveApiKey(provider, value).catch(() => {});
  },

  setUseAccountKeys: (v) => set({ useAccountKeys: v }),

  updateUserName: (name) => set((s) => ({ user: { ...s.user, name } })),
}));

export function useActiveWorkspace() {
  return useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
}