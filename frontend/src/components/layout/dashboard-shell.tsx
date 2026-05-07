import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ProjectBreadcrumb } from "./project-breadcrumb";

export function DashboardShell({ children }: { children?: ReactNode }) {
  // We use router state to determine if we're in a project context.
  const { location } = useRouterState();
  const inProject = location.pathname.match(
    /^\/dashboard\/projects\/([^/]+)/,
  );
  const projectId = inProject?.[1];

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar>
          <ProjectBreadcrumb />
        </Topbar>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

// Re-export for convenience.
export { useParams };
