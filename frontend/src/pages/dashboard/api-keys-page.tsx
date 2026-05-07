import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Plus, ShieldX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useProject } from "@/features/projects/hooks";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/features/api-keys/hooks";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ApiKey, ApiKeyEnvironment, ApiKeyScope } from "@/types/api";

const SCOPES: ApiKeyScope[] = ["read", "write", "delete", "admin"];

export function ApiKeysPage({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: keys, isLoading } = useApiKeys(projectId);
  const createKey = useCreateApiKey(projectId);
  const revokeKey = useRevokeApiKey(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<ApiKey | null>(null);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<ApiKeyEnvironment>("test");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["read", "write"]);

  function toggleScope(s: ApiKeyScope) {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      const key = await createKey.mutateAsync({
        name,
        scopes,
        environment: env,
      });
      setRevealKey(key);
      setDialogOpen(false);
      setName("");
      toast.success("API key created");
    } catch (err) {
      toast.error("Failed to create key", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function onRevoke(key: ApiKey) {
    if (!confirm(`Revoke key "${key.name}"? This cannot be undone.`)) return;
    try {
      await revokeKey.mutateAsync(key.id);
      toast.success("API key revoked");
    } catch (err) {
      toast.error("Revoke failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project?.name ?? "Project"}
        title="API keys"
        description="Authenticate SDK and HTTP clients. Keys are HMAC-hashed at rest — the plaintext is shown only once."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create key
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
          <CardDescription>
            Rotate keys regularly. Revoked keys stop authenticating immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !keys || keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Create your first key to start using the SDKs."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create key
                </Button>
              }
              className="m-5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="pl-5">
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Created {formatDateTime(k.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs">
                        {k.key_prefix}…{k.id.slice(-4)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="outline" className="capitalize">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={k.environment === "live" ? "success" : "muted"}
                      >
                        {k.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.last_used_at ? formatRelative(k.last_used_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      {k.revoked_at ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onRevoke(k)}
                          aria-label={`Revoke ${k.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Choose a friendly name and the minimum scopes this key needs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production server"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={env}
                  onValueChange={(v) => setEnv(v as ApiKeyEnvironment)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">test (sandbox)</SelectItem>
                    <SelectItem value="live">live (production)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SCOPES.map((s) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm capitalize transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={scopes.includes(s)}
                        onChange={() => toggleScope(s)}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createKey.isPending || !name || scopes.length === 0}
              >
                {createKey.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revealKey}
        onOpenChange={(open) => !open && setRevealKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-warning" />
              Save this key now
            </DialogTitle>
            <DialogDescription>
              You won't be able to see the full key again. Copy it and store it
              somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-input/40 p-3 font-mono text-xs leading-relaxed break-all">
              {revealKey?.full_key}
            </div>
            <div className="flex gap-2">
              <CopyButton
                value={revealKey?.full_key ?? ""}
                label="Copy key"
                size="default"
                variant="default"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setRevealKey(null)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
