import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useCreateProject } from "@/features/projects/hooks";
import type { StorageBackend, StorageRegion } from "@/types/api";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const create = useCreateProject();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState<StorageRegion>("us-east-1");
  const [backend, setBackend] = useState<StorageBackend>("s3");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const project = await create.mutateAsync({
        name,
        slug: slug || slugify(name),
        description,
        storage_region: region,
        storage_backend: backend,
      });
      toast.success("Project created", {
        description: "Your bucket prefix and starter API key are ready.",
      });
      navigate({ to: `/dashboard/projects/${project.id}` });
    } catch (err) {
      toast.error("Failed to create project", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="New project"
        description="Create an isolated workspace with its own storage prefix, API keys, and webhooks."
      />

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
              <CardDescription>
                A friendly name and a slug used in URLs and the bucket prefix.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Acme Marketing Site"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="acme-marketing"
                  className="font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Bucket prefix:{" "}
                  <span className="font-mono text-foreground">
                    fv-{slug || "your-slug"}/
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes for your team"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>
                Choose where files will live. Region cannot be changed later.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={region}
                  onValueChange={(v) => setRegion(v as StorageRegion)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="eu-west-1">EU West (Ireland)</SelectItem>
                    <SelectItem value="af-south-1">Africa (Cape Town)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Backend</Label>
                <Select
                  value={backend}
                  onValueChange={(v) => setBackend(v as StorageBackend)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s3">AWS S3</SelectItem>
                    <SelectItem value="r2">Cloudflare R2</SelectItem>
                    <SelectItem value="b2">Backblaze B2</SelectItem>
                    <SelectItem value="minio">MinIO (self-hosted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Review and confirm.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label="Name" value={name || "—"} />
            <Row label="Slug" value={slug || "—"} mono />
            <Row label="Region" value={region} mono />
            <Row label="Backend" value={backend.toUpperCase()} mono />
            <Row label="Tier" value="Hobby (free)" />

            <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/dashboard/projects" })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !name}>
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Create project
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
