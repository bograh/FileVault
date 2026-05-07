import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  FolderPlus,
  Globe2,
  HardDrive,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useProjects } from "@/features/projects/hooks";
import { projectsApi } from "@/services";
import { useQueries } from "@tanstack/react-query";
import { formatBytes } from "@/lib/format";
import type { ProjectUsage, SubscriptionTier } from "@/types/api";

const tierColor: Record<SubscriptionTier, "default" | "outline" | "success" | "muted"> = {
  hobby: "muted",
  starter: "outline",
  pro: "success",
  enterprise: "default",
};

export function ProjectsListPage() {
  const { data: projects, isLoading } = useProjects();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = search.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const usageQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: ["projects", p.id, "usage"],
      queryFn: () => projectsApi.usage(p.id),
      staleTime: 60_000,
    })),
  });
  const usageById = useMemo(() => {
    const m = new Map<string, ProjectUsage>();
    usageQueries.forEach((q, i) => {
      const p = projects?.[i];
      if (q.data && p) m.set(p.id, q.data);
    });
    return m;
  }, [usageQueries, projects]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project is isolated — its own bucket, API keys, webhooks, and quotas."
        actions={
          <Button asChild>
            <Link to="/dashboard/projects/new">
              <Plus className="h-4 w-4" /> New project
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name, slug, or ID..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title={search ? "No projects match your search" : "Create your first project"}
          description={
            search
              ? "Try a different search term."
              : "Each project gets its own bucket prefix, API keys, and webhooks."
          }
          action={
            !search ? (
              <Button asChild>
                <Link to="/dashboard/projects/new">Create project</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const usage = usageById.get(p.id);
            const storagePct = usage
              ? Math.min(
                  100,
                  (usage.storage_bytes / usage.storage_quota_bytes) * 100,
                )
              : 0;
            return (
              <Card
                key={p.id}
                className="group relative overflow-hidden transition-all hover:border-primary/30"
              >
                <Link
                  to="/dashboard/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="absolute inset-0 z-10"
                  aria-label={`Open ${p.name}`}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <CardTitle className="truncate">{p.name}</CardTitle>
                      <CardDescription className="truncate font-mono text-[11px]">
                        {p.slug}
                      </CardDescription>
                    </div>
                    <Badge variant={tierColor[p.subscription_tier as SubscriptionTier]}>
                      {p.subscription_tier}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="line-clamp-2 text-muted-foreground">
                    {p.description || "No description provided."}
                  </p>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="text-foreground">
                        {usage
                          ? `${formatBytes(usage.storage_bytes)} / ${formatBytes(
                              usage.storage_quota_bytes,
                            )}`
                          : "—"}
                      </span>
                    </div>
                    <Progress value={storagePct} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="h-3.5 w-3.5" />
                      {p.storage_region}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      {p.storage_backend.toUpperCase()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
