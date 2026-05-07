/**
 * Service layer — single import point for all API calls.
 *
 * Today these proxy through the mock layer in `@/mocks/api`.
 * When the real backend exists, replace this file (or the individual
 * named exports) with `fetch`-based HTTP clients that implement the
 * same signatures. UI code never imports from `@/mocks` directly.
 */
export {
  authApi,
  projectsApi,
  uploadsApi,
  apiKeysApi,
  webhooksApi,
  billingApi,
  dashboardApi,
  MockApiError as ApiError,
} from "@/mocks/api";
export type { DashboardOverview } from "@/mocks/api";
