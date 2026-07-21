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
  prompts: Prompt[];
  isInitializing: boolean;
  tokenUsage: Record<string, number>;
  activeProvider: string | null;
  apiKeys: Record<ApiProvider, { value: string; status: ApiKeyStatus }>;
  useAccountKeys: boolean;
  voiceProvider: VoiceProvider | "auto";
  adminUsers: AdminUser[];

  createWorkspace: (name?: string) => Promise<string>;
  setActiveWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setDefaultModel: (id: string, model: string) => Promise<void>;
  sendMessage: (workspaceId: string, text: string) => void;
  addPrompt: (workspaceId: string, prompt: Omit<Prompt, "id" | "createdAt">) => void;
  saveApiKey: (provider: ApiProvider, value: string) => void;
  removeApiKey: (provider: ApiProvider) => void;
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
  loadPrompts: () => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  recordTokenUsage: (provider: string, tokens: number) => void;
  setActiveProvider: (provider: string) => void;
};

let _uidCounter = 0;
const uid = () => `id${(++_uidCounter).toString(36)}`;

export const useStore = create<State>((set, get) => ({
  user: { name: "", email: "", role: "user", provider: "clerk" },
  workspaces: [],
  activeWorkspaceId: "",
  tools: [],
  prompts: [],
  isInitializing: true,
  tokenUsage: {},
  activeProvider: null,
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

  recordTokenUsage: (provider, tokens) =>
    set((s) => ({
      tokenUsage: {
        ...s.tokenUsage,
        [provider]: (s.tokenUsage[provider] ?? 0) + tokens,
      },
    })),

  setActiveProvider: (provider) => set({ activeProvider: provider }),

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
        defaultModel: w.default_model || "llama-3.3-70b",
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
          const realKey = localStorage.getItem(`apikey_${item.provider}`) || item.masked_key;
          updates[item.provider as ApiProvider] = { value: realKey, status: item.status as ApiKeyStatus };
        }
      }
      set((s) => ({ apiKeys: { ...s.apiKeys, ...updates } }));
      const priority: ApiProvider[] = ["Groq", "OpenAI", "Anthropic", "Google", "DeepSeek"];
      const active = priority.find((p) => updates[p]?.status === "valid");
      if (active) set({ activeProvider: active });
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

  loadPrompts: async () => {
    try {
      const data = await api.getPrompts();
      const mapped: Prompt[] = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        platform: p.platform as Platform,
        body: p.body,
        createdAt: new Date(p.created_at).getTime(),
      }));
      set({ prompts: mapped });
    } catch (e) {
      console.error("Failed to load prompts", e);
    }
  },

  deletePrompt: async (id) => {
    set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
    try {
      await api.deletePrompt(id);
    } catch (e) {
      console.error("Failed to delete prompt", e);
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

  renameWorkspace: async (id, name) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
    }));
    try {
      await api.updateWorkspace(id, { name });
    } catch (e) {
      console.error("Failed to rename workspace", e);
    }
  },

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

  setDefaultModel: async (id, model) => {
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, defaultModel: model } : w)),
    }));
    try {
      await api.updateWorkspace(id, { default_model: model });
    } catch (e) {
      console.error("Failed to save default model", e);
    }
  },

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

        const generatedPrompt = msg.generated_prompt || undefined;
        const consensus = msg.consensus || undefined;
        const toolsArr: ToolRec[] | undefined =
          Array.isArray(msg.tools) && msg.tools.length > 0
            ? msg.tools
            : msg.tool
            ? [msg.tool]
            : undefined;

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

        if (generatedPrompt) {
          const newPrompt: Prompt = {
            id: uid(),
            title: generatedPrompt.title,
            platform: generatedPrompt.platform as Platform,
            body: generatedPrompt.body,
            createdAt: Date.now(),
          };
          set((s) => ({ prompts: [newPrompt, ...s.prompts] }));
        }

        // Record token usage if available in response
        if (reply.usage && reply.usage.total_tokens && reply.usage.provider) {
          get().recordTokenUsage(reply.usage.provider, reply.usage.total_tokens);
        }

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
      prompts: [full, ...s.prompts],
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, prompts: [full, ...w.prompts] } : w,
      ),
    }));
  },

  saveApiKey: (provider, value) => {
    const status: ApiKeyStatus =
      value.length === 0 ? "unset" : value.length > 20 ? "valid" : "invalid";
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: { value, status } } }));
    if (value) localStorage.setItem(`apikey_${provider}`, value);   // ← localStorage
    else localStorage.removeItem(`apikey_${provider}`);
    api.saveApiKey(provider, value).catch(() => {});
  },

  removeApiKey: (provider) => {
    localStorage.removeItem(`apikey_${provider}`);
    set((s) => ({
      apiKeys: {
        ...s.apiKeys,
        [provider]: { value: "", status: "unset" },
      },
    }));
    api.saveApiKey(provider, "").catch(() => {});
  },

  setUseAccountKeys: (v) => set({ useAccountKeys: v }),

  updateUserName: (name) => set((s) => ({ user: { ...s.user, name } })),
}));

export function useActiveWorkspace() {
  return useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
}