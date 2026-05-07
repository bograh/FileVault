import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Database,
  HardDrive,
  KeyRound,
  Network,
  Settings2,
  UploadCloud,
  Webhook,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  useProject,
  useProjectStats,
  useProjectUsage,
} from "@/features/projects/hooks";
import { formatBytes, formatNumber } from "@/lib/format";

export function ProjectOverviewPage({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: usage } = useProjectUsage(projectId);
  const { data: stats } = useProjectStats(projectId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project"
        title={project?.name ?? "Loading..."}
        description={project?.description}
        actions={
          project ? (
            <>
              <Badge variant="outline">{project.subscription_tier}</Badge>
              <Badge variant="muted">{project.storage_region}</Badge>
            </>
          ) : null
        }
      />

      {project ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Project ID
              </div>
              <code className="font-mono text-sm">{project.id}</code>
            </div>
            <div className="hidden h-8 w-px bg-border md:block" />
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Bucket prefix
              </div>
              <code className="font-mono text-sm">
                {project.bucket_prefix}/
              </code>
            </div>
            <div className="hidden h-8 w-px bg-border md:block" />
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Backend
              </div>
              <code className="font-mono text-sm">
                {project.storage_backend.toUpperCase()} ·{" "}
                {project.storage_region}
              </code>
            </div>
            <CopyButton value={project.id} label="Copy ID" />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!usage ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              icon={HardDrive}
              label="Storage"
              value={formatBytes(usage.storage_bytes)}
              hint={`/ ${formatBytes(usage.storage_quota_bytes)}`}
              footer={
                <Progress
                  value={
                    (usage.storage_bytes / usage.storage_quota_bytes) * 100
                  }
                />
              }
            />
            <StatCard
              icon={Network}
              label="Bandwidth"
              value={formatBytes(usage.bandwidth_bytes)}
              hint={`/ ${formatBytes(usage.bandwidth_quota_bytes)}`}
              accent="success"
              footer={
                <Progress
                  value={
                    (usage.bandwidth_bytes / usage.bandwidth_quota_bytes) * 100
                  }
                  indicatorClassName="bg-success"
                />
              }
            />
            <StatCard
              icon={Activity}
              label="API requests"
              value={formatNumber(usage.api_requests)}
              hint={`/ ${formatNumber(usage.api_requests_quota)}`}
              accent="warning"
              footer={
                <Progress
                  value={
                    (usage.api_requests / usage.api_requests_quota) * 100
                  }
                  indicatorClassName="bg-warning"
                />
              }
            />
            <StatCard
              icon={Database}
              label="Files"
              value={formatNumber(usage.file_count)}
              hint="objects stored"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily uploads</CardTitle>
            <CardDescription>Last 30 days for this project.</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={stats.map((p) => ({
                    date: p.date,
                    uploads: p.uploads,
                    downloads: p.downloads,
                  }))}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) =>
                      new Date(d as string).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="uploads"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="downloads"
                    fill="oklch(0.78 0.16 200)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Manage this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink
              to={`/dashboard/projects/${projectId}/uploads`}
              icon={UploadCloud}
              title="Files"
              hint="Browse, search, and delete."
            />
            <QuickLink
              to={`/dashboard/projects/${projectId}/keys`}
              icon={KeyRound}
              title="API keys"
              hint="Create and revoke keys."
            />
            <QuickLink
              to={`/dashboard/projects/${projectId}/webhooks`}
              icon={Webhook}
              title="Webhooks"
              hint="Endpoints and delivery log."
            />
            <QuickLink
              to={`/dashboard/projects/${projectId}/settings`}
              icon={Settings2}
              title="Settings"
              hint="Quotas, MIME types, domain."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  hint,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </Link>
  );
}
