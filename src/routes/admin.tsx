import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect , useState } from "react";
import { AppShell } from "@/components/disha/app-shell";
import { useStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, UserX, UserCheck, Trash2, Zap, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Disha" },
      { name: "description", content: "Admin controls for tool approvals, users, and usage monitoring." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user.role !== "admin") {
      toast.error("Admin access required");
      navigate({ to: "/" });
    }
  }, [user.role, navigate]);

  if (user.role !== "admin") return null;

  return (
    <AppShell header={<h1 className="font-display text-base font-semibold">Admin</h1>}>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-8">
        <header>
          <h2 className="font-display text-3xl font-bold tracking-tight">Admin console</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Approvals, user management, and platform usage — all in one place.
          </p>
        </header>
        <ToolApprovalsSection />
        <UserManagementSection />
        <UsageMonitoringSection />
      </div>
    </AppShell>
  );
}

function SectionCard({ title, description, icon: Icon, children }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Icon className="size-4" />
          </div>
        )}
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ToolApprovalsSection() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPendingTools()
      .then(setPending)
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    await api.approveTool(id);
    setPending((p) => p.filter((t) => t.id !== id));
    toast.success(`Approved`);
  };

  const handleReject = async (id: string) => {
    await api.rejectTool(id);
    setPending((p) => p.filter((t) => t.id !== id));
    toast(`Rejected`);
  };

  return (
    <SectionCard
      title="Tool Approvals"
      description="Review new tools submitted to the registry."
      icon={ShieldAlert}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No pending tools. You're all caught up.
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold">{t.name}</span>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleApprove(t.id)}>
                  <Check className="size-4" /> Approve
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleReject(t.id)}>
                  <X className="size-4" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function UserManagementSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSuspend = async (id: string, name: string) => {
    await api.suspendUser(id);
    setUsers((u) => u.map((x) => x.id === id ? { ...x, role: "suspended" } : x));
    toast(`Suspended ${name}`);
  };

  const handleActivate = (id: string, name: string) => {
    setUsers((u) => u.map((x) => x.id === id ? { ...x, role: "user" } : x));
    toast.success(`Reactivated ${name}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await api.deleteAdminUser(id);
    setUsers((u) => u.filter((x) => x.id !== id));
    toast.success(`Deleted ${name}`);
  };

  return (
    <SectionCard
      title="User Management"
      description="Suspend or remove accounts across the platform."
      icon={UserCheck}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {u.role !== "suspended" ? (
                        <Button size="sm" variant="ghost" onClick={() => handleSuspend(u.id, u.name)}>
                          <UserX className="size-4" /> Suspend
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleActivate(u.id, u.name)}>
                          <UserCheck className="size-4" /> Activate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(u.id, u.name)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No users.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function UsageMonitoringSection() {
  return (
    <SectionCard
      title="Usage Monitoring"
      description="Live metrics land here once billing integrations are wired up."
      icon={Zap}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageCard
          icon={Coins}
          label="Railway credits"
          value="—"
          hint="Connect Railway to display remaining credits and monthly burn."
        />
        <UsageCard
          icon={Zap}
          label="Groq tokens"
          value="—"
          hint="Connect Groq usage API to display tokens consumed this cycle."
        />
      </div>
    </SectionCard>
  );
}

function UsageCard({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
