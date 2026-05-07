/**
 * Service layer — single import point for all API calls.
 *
 * When VITE_API_URL is set, uses the real HTTP client.
 * Otherwise falls back to the mock layer for local UI development.
 */

const USE_REAL_API = !!import.meta.env.VITE_API_URL;

// Conditional re-exports: real backend or mock layer.
// The real client (http-client.ts) implements the exact same signatures.
export const {
  authApi,
  projectsApi,
  uploadsApi,
  apiKeysApi,
  webhooksApi,
  billingApi,
  dashboardApi,
  ApiError,
} = USE_REAL_API
  ? await import("@/services/http-client")
  : await import("@/mocks/api").then((m) => ({
      ...m,
      ApiError: m.MockApiError,
    }));

export type { DashboardOverview } from "@/services/http-client";
