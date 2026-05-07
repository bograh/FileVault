import { useState, type FormEvent } from "react";
import { Loader2, Plus, Send, Trash2, Webhook } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WebhookStatusBadge } from "@/components/status-pill";
import { useProject } from "@/features/projects/hooks";
import {
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useToggleWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from "@/features/webhooks/hooks";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { WebhookEvent } from "@/types/api";

const EVENTS: WebhookEvent[] = [
  "upload.completed",
  "upload.failed",
  "file.deleted",
  "quota.warning",
  "billing.invoice.created",
];

export function WebhooksPage({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: hooks, isLoading } = useWebhooks(projectId);
  const createHook = useCreateWebhook(projectId);
  const deleteHook = useDeleteWebhook(projectId);
  const toggleHook = useToggleWebhook(projectId);
  const testHook = useTestWebhook(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([
    "upload.completed",
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: deliveries } = useWebhookDeliveries(projectId, selectedId);

  function toggleEvent(e: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await createHook.mutateAsync({ url, events });
      setDialogOpen(false);
      setUrl("");
      setEvents(["upload.completed"]);
      toast.success("Webhook endpoint added");
    } catch (err) {
      toast.error("Create failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function sendTest(endpointId: string) {
    try {
      await testHook.mutateAsync(endpointId);
      toast.success("Test event delivered");
      setSelectedId(endpointId);
    } catch (err) {
      toast.error("Test failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project?.name ?? "Project"}
        title="Webhooks"
        description="Subscribe to upload, file, and billing events. Payloads are signed with HMAC-SHA256 and retried up to 5×."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add endpoint
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            Disabled endpoints stop receiving events but are kept in the log for
            history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !hooks || hooks.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="No webhooks yet"
              description="Add an endpoint to start receiving event notifications."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add endpoint
                </Button>
              }
              className="m-5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {hooks.map((w) => (
                  <TableRow
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    className="cursor-pointer"
                    data-state={selectedId === w.id ? "selected" : undefined}
                  >
                    <TableCell className="pl-5">
                      <div className="font-mono text-xs">{w.url}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Secret: {w.secret_prefix}…
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <Badge
                            key={e}
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={w.enabled}
                        onCheckedChange={(checked) =>
                          toggleHook.mutate({
                            endpointId: w.id,
                            enabled: checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelative(w.created_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendTest(w.id)}
                          disabled={testHook.isPending}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Test
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm("Delete this webhook endpoint?"))
                              return;
                            await deleteHook.mutateAsync(w.id);
                            if (selectedId === w.id) setSelectedId(null);
                            toast.success("Endpoint deleted");
                          }}
                          aria-label="Delete endpoint"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedId ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent deliveries</CardTitle>
            <CardDescription>
              Last 25 deliveries for the selected endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!deliveries ? (
              <div className="space-y-2 p-5">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No deliveries yet"
                description='Click "Test" to send a sample event.'
                className="m-5"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="pl-5">
                        <code className="font-mono text-xs">
                          {d.event_type}
                        </code>
                      </TableCell>
                      <TableCell>
                        <WebhookStatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.response_status ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.attempt_count}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.duration_ms} ms
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(d.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>Add webhook endpoint</DialogTitle>
              <DialogDescription>
                We'll POST signed event payloads to this URL. Make sure your
                handler responds with 2xx within 5 seconds.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.example.com/filevault/webhooks"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="space-y-1.5">
                  {EVENTS.map((e) => (
                    <label
                      key={e}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={events.includes(e)}
                        onChange={() => toggleEvent(e)}
                      />
                      <code className="font-mono text-xs">{e}</code>
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
                disabled={
                  createHook.isPending || !url || events.length === 0
                }
              >
                {createHook.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Add endpoint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
