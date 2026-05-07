import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

import { LandingPage } from "@/pages/marketing/landing";
import { LoginPage } from "@/pages/auth/login-page";
import { SignupPage } from "@/pages/auth/signup-page";
import { DashboardOverviewPage } from "@/pages/dashboard/overview-page";
import { ProjectsListPage } from "@/pages/dashboard/projects-list-page";
import { NewProjectPage } from "@/pages/dashboard/new-project-page";
import { ProjectOverviewPage } from "@/pages/dashboard/project-overview-page";
import { UploadsPage } from "@/pages/dashboard/uploads-page";
import { ApiKeysPage } from "@/pages/dashboard/api-keys-page";
import { WebhooksPage } from "@/pages/dashboard/webhooks-page";
import { ProjectSettingsPage } from "@/pages/dashboard/project-settings-page";
import { BillingPage } from "@/pages/dashboard/billing-page";
import { AccountSettingsPage } from "@/pages/dashboard/account-settings-page";
import { NotFoundPage } from "@/pages/not-found-page";

export interface RouterContext {
  queryClient: QueryClient;
}

const SESSION_KEY = "filevault.session";

function isAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expires_at: string };
    return new Date(parsed.expires_at).getTime() > Date.now();
  } catch {
    return false;
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});

// -------------------- Public --------------------

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

// -------------------- Authenticated shell --------------------

const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "dashboard-layout",
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  // Auth context exists in root; this layout just wraps children with the shell.
  // useAuth ensures we don't render before AuthProvider is mounted.
  useAuth();
  return <DashboardShell />;
}

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard",
  component: DashboardOverviewPage,
});

const projectsListRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects",
  component: ProjectsListPage,
});

const newProjectRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/new",
  component: NewProjectPage,
});

const projectOverviewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/$projectId",
  component: function ProjectOverviewWrapper() {
    const { projectId } = projectOverviewRoute.useParams();
    return <ProjectOverviewPage projectId={projectId} />;
  },
});

const projectUploadsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/$projectId/uploads",
  component: function UploadsWrapper() {
    const { projectId } = projectUploadsRoute.useParams();
    return <UploadsPage projectId={projectId} />;
  },
});

const projectKeysRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/$projectId/keys",
  component: function KeysWrapper() {
    const { projectId } = projectKeysRoute.useParams();
    return <ApiKeysPage projectId={projectId} />;
  },
});

const projectWebhooksRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/$projectId/webhooks",
  component: function WebhooksWrapper() {
    const { projectId } = projectWebhooksRoute.useParams();
    return <WebhooksPage projectId={projectId} />;
  },
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/projects/$projectId/settings",
  component: function SettingsWrapper() {
    const { projectId } = projectSettingsRoute.useParams();
    return <ProjectSettingsPage projectId={projectId} />;
  },
});

const billingRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/billing",
  component: BillingPage,
});

const accountSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/dashboard/settings",
  component: AccountSettingsPage,
});

// -------------------- Tree --------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  dashboardLayoutRoute.addChildren([
    dashboardIndexRoute,
    projectsListRoute,
    newProjectRoute,
    projectOverviewRoute,
    projectUploadsRoute,
    projectKeysRoute,
    projectWebhooksRoute,
    projectSettingsRoute,
    billingRoute,
    accountSettingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined! }, // injected from main.tsx via RouterProvider
  defaultPreload: "intent",
  defaultNotFoundComponent: NotFoundPage,
});
