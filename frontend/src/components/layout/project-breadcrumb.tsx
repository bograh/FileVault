import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Slash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/services";
import { useProjects } from "@/features/projects/hooks";

const SECTION_LABELS: Record<string, string> = {
  uploads: "Files",
  keys: "API Keys",
  webhooks: "Webhooks",
  settings: "Settings",
  billing: "Billing",
  projects: "Projects",
  new: "New project",
};

export function ProjectBreadcrumb() {
  const { location } = useRouterState();
  const path = location.pathname;
  const segments = path.split("/").filter(Boolean);

  // /dashboard/projects/:id/...
  const projectMatch = path.match(/^\/dashboard\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];
  const isNew = projectId === "new";

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: !!projectId && !isNew,
  });

  // Use cached project list to render the project name even before single project load.
  const { data: projects } = useProjects();
  const cached = projects?.find((p) => p.id === projectId);
  const projectName =
    project?.name ?? cached?.name ?? (isNew ? "New project" : null);

  // Build crumbs.
  const crumbs: Array<{ label: string; to?: string }> = [];
  if (segments[0] === "dashboard") {
    crumbs.push({ label: "Dashboard", to: "/dashboard" });
    if (segments[1] === "projects") {
      crumbs.push({ label: "Projects", to: "/dashboard/projects" });
      if (projectId && !isNew && projectName) {
        crumbs.push({
          label: projectName,
          to: `/dashboard/projects/${projectId}`,
        });
        if (segments[3]) {
          crumbs.push({
            label: SECTION_LABELS[segments[3]!] ?? segments[3]!,
          });
        }
      } else if (isNew) {
        crumbs.push({ label: "New project" });
      }
    } else if (segments[1] === "billing") {
      crumbs.push({ label: "Billing" });
    } else if (segments[1] === "settings") {
      crumbs.push({ label: "Account" });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1 truncate text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1 truncate">
            {i === 0 ? (
              <Slash className="h-3.5 w-3.5 text-muted-foreground/50" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
            {c.to && !last ? (
              <Link
                to={c.to}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
