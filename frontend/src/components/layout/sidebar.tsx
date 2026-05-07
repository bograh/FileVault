import { Link, useRouterState } from "@tanstack/react-router";
import {
  CreditCard,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Settings2,
  Shapes,
  UploadCloud,
  Webhook,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  matchPrefix?: string;
}

const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    to: "/dashboard/projects",
    label: "Projects",
    icon: FolderOpen,
    matchPrefix: "/dashboard/projects",
  },
  { to: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { to: "/dashboard/settings", label: "Account", icon: Settings },
];

const HELP: NavItem[] = [
  { to: "/docs", label: "Documentation", icon: LifeBuoy },
];

export interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const { location } = useRouterState();
  const path = location.pathname;

  const isActive = (item: NavItem): boolean => {
    if (item.exact) return path === item.to;
    if (item.matchPrefix) return path.startsWith(item.matchPrefix);
    return path === item.to;
  };

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-border/60 md:bg-card/30">
      <div className="flex h-16 items-center px-5">
        <Link to="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 text-primary-foreground shadow-md">
            <Shapes className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            FileVault
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 px-3 pb-6">
        <div className="space-y-1">
          <SidebarLabel>Workspace</SidebarLabel>
          {PRIMARY.map((item) => (
            <SidebarLink key={item.to} item={item} active={isActive(item)} />
          ))}
        </div>

        {projectId ? <ProjectSubnav projectId={projectId} path={path} /> : null}

        <div className="space-y-1">
          <SidebarLabel>Help</SidebarLabel>
          {HELP.map((item) => (
            <a
              key={item.to}
              href="https://docs.filevault.io"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}

function SidebarLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
      {children}
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {item.label}
    </Link>
  );
}

const PROJECT_TABS: Omit<NavItem, "matchPrefix" | "exact">[] = [
  { to: "", label: "Overview", icon: LayoutDashboard },
  { to: "/uploads", label: "Files", icon: UploadCloud },
  { to: "/keys", label: "API Keys", icon: KeyRound },
  { to: "/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

function ProjectSubnav({
  projectId,
  path,
}: {
  projectId: string;
  path: string;
}) {
  return (
    <div className="space-y-1">
      <SidebarLabel>Project</SidebarLabel>
      {PROJECT_TABS.map((tab) => {
        const fullPath = `/dashboard/projects/${projectId}${tab.to}`;
        const active =
          tab.to === ""
            ? path === fullPath
            : path === fullPath || path.startsWith(`${fullPath}/`);
        return (
          <Link
            key={tab.to || "overview"}
            to={fullPath}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tab.icon
              className={cn(
                "h-4 w-4",
                active
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
