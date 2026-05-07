import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  CloudUpload,
  Database,
  FolderPlus,
  HardDrive,
  Network,
  Plus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { FileTypeIcon } from "@/components/file-icon";
import { UploadStatusBadge } from "@/components/status-pill";
import { useDashboardOverview, useProjects } from "@/features/projects/hooks";
import { formatBytes, formatNumber, formatRelative } from "@/lib/format";

export function DashboardOverviewPage() {
  const { data, isLoading } = useDashboardOverview();
  const { data: projects } = useProjects();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="Real-time view of all your FileVault projects, usage, and recent uploads."
        actions={
          <Button asChild>
            <Link to="/dashboard/projects/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? (
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
              label="Total storage"
              value={formatBytes(data.totals.storage_bytes)}
              hint={`/ ${formatBytes(data.totals.storage_quota_bytes)}`}
              delta={{ value: 6.2, label: " vs. last month" }}
            />
            <StatCard
              icon={Network}
              label="Bandwidth"
              value={formatBytes(data.totals.bandwidth_bytes)}
              hint="this period"
              delta={{ value: 12.4 }}
              accent="success"
            />
            <StatCard
              icon={Activity}
              label="API requests"
              value={formatNumber(data.totals.api_requests)}
              hint="this period"
              delta={{ value: -2.1 }}
              accent="warning"
            />
            <StatCard
              icon={Database}
              label="Files stored"
              value={formatNumber(data.totals.file_count)}
              hint={`across ${data.totals.project_count} projects`}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Bandwidth & uploads</CardTitle>
              <CardDescription>Last 30 days, all projects</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/billing">
                Usage breakdown <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2">
            {isLoading || !data ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart
                  data={data.trend.map((p) => ({
                    date: p.date,
                    bandwidth: Math.round(p.bandwidth_bytes / 1024 / 1024),
                    uploads: p.uploads,
                  }))}
                  margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="oklch(0.78 0.16 200)"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor="oklch(0.78 0.16 200)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
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
                    stroke="var(--color-muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
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
                    labelFormatter={(d) => new Date(d as string).toDateString()}
                    formatter={(v: number, k: string) =>
                      k === "bandwidth"
                        ? [`${formatNumber(v)} MB`, "Bandwidth"]
                        : [`${formatNumber(v)}`, "Uploads"]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="bandwidth"
                    stroke="var(--color-primary)"
                    fill="url(#bw)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="uploads"
                    stroke="oklch(0.78 0.16 200)"
                    fill="url(#up)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Quick links to your workspaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!projects ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                title="No projects yet"
                description="Create your first project to get an API key."
                action={
                  <Button asChild>
                    <Link to="/dashboard/projects/new">Create project</Link>
                  </Button>
                }
              />
            ) : (
              projects.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/dashboard/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.storage_region} · {p.subscription_tier}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))
            )}
            <Button variant="ghost" size="sm" asChild className="w-full">
              <Link to="/dashboard/projects">View all projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>Recent uploads</CardTitle>
            <CardDescription>Across all projects.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!data ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : data.recent_uploads.length === 0 ? (
            <EmptyState
              icon={CloudUpload}
              title="No uploads yet"
              description="Files uploaded by SDK or API will appear here in real time."
              className="m-5"
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {data.recent_uploads.map((u) => {
                const project = projects?.find((p) => p.id === u.project_id);
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                  >
                    <FileTypeIcon contentType={u.content_type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {u.filename}
                        </span>
                        <UploadStatusBadge status={u.status} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {project?.name ?? u.project_id} ·{" "}
                        {formatBytes(u.size_bytes)} ·{" "}
                        {formatRelative(u.created_at)}
                      </div>
                    </div>
                    <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
                      {u.id}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
