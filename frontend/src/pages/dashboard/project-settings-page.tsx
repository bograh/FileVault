import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from "@/features/projects/hooks";

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const remove = useDeleteProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxSizeMB, setMaxSizeMB] = useState("500");
  const [allowedMime, setAllowedMime] = useState("");
  const [versioning, setVersioning] = useState(false);
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description);
    setMaxSizeMB(String(Math.round(project.max_file_size_bytes / 1024 / 1024)));
    setAllowedMime((project.allowed_mime_types ?? []).join(", "));
    setVersioning(project.versioning_enabled);
    setCustomDomain(project.custom_domain ?? "");
  }, [project]);

  if (!project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const allowedMimeTypes = allowedMime
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await update.mutateAsync({
        name,
        description,
        max_file_size_bytes: Math.max(1, Number(maxSizeMB)) * 1024 * 1024,
        allowed_mime_types: allowedMimeTypes.length ? allowedMimeTypes : null,
        versioning_enabled: versioning,
        custom_domain: customDomain || null,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function onDelete() {
    if (
      !confirm(
        `Delete "${project!.name}" and all its files? This cannot be undone.`,
      )
    )
      return;
    try {
      await remove.mutateAsync(projectId);
      toast.success("Project deleted");
      navigate({ to: "/dashboard/projects" });
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project.name}
        title="Project settings"
        description="Configure quotas, MIME policies, custom domain, and versioning."
      />

      <form onSubmit={onSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
            <CardDescription>Visible to your team and in audit logs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload policy</CardTitle>
            <CardDescription>
              Enforced at presigned URL generation — S3 rejects oversized
              uploads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="size">Max file size (MB)</Label>
              <Input
                id="size"
                type="number"
                min={1}
                value={maxSizeMB}
                onChange={(e) => setMaxSizeMB(e.target.value)}
                className="max-w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mime">Allowed MIME types</Label>
              <Textarea
                id="mime"
                value={allowedMime}
                onChange={(e) => setAllowedMime(e.target.value)}
                placeholder="image/*, application/pdf, text/plain (leave empty to allow all)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Wildcards like <code>image/*</code> are
                supported.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
            <CardDescription>
              Versioning and custom domain — Pro tier and above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">File versioning</Label>
                <p className="text-xs text-muted-foreground">
                  Keep previous versions for the configured retention window.
                </p>
              </div>
              <Switch
                checked={versioning}
                onCheckedChange={setVersioning}
                disabled={project.subscription_tier === "hobby"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Custom domain</Label>
              <Input
                id="domain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="cdn.your-app.com"
                disabled={
                  project.subscription_tier === "hobby" ||
                  project.subscription_tier === "starter"
                }
              />
              <p className="text-xs text-muted-foreground">
                Add a CNAME record pointing to{" "}
                <code className="font-mono">cname.filevault.io</code>.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="border-destructive/30 bg-destructive/[0.04]">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deleting a project removes all uploads, keys, and webhooks.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={remove.isPending}
          >
            {remove.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete project
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
