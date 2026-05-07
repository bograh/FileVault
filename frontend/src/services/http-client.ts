/**
 * Real HTTP client for the FileVault backend API.
 *
 * Replaces the mock layer when VITE_API_URL is set.
 * Uses the same function signatures as the mock API so the UI code
 * doesn't need changes.
 */

import type {
  ApiKey,
  ApiKeyScope,
  Invoice,
  Page,
  Plan,
  Project,
  ProjectStatPoint,
  ProjectUsage,
  Session,
  Subscription,
  SubscriptionTier,
  Upload,
  UploadListParams,
  User,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEvent,
} from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/v1";

export class ApiError extends Error {
  code: string;
  docs_url?: string;
  constructor(code: string, message: string, docs_url?: string) {
    super(message);
    this.code = code;
    this.docs_url = docs_url;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include", // send session cookie
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, opts);
  const json = await res.json();

  if (!res.ok) {
    const err = json.error || { code: "UNKNOWN", message: "Unknown error" };
    throw new ApiError(err.code, err.message, err.docs_url);
  }

  return json.data as T;
}



export const authApi = {
  async login(params: {
    email: string;
    password: string;
    totp_code?: string;
  }): Promise<Session | { requires_2fa: true; challenge_id: string }> {
    return request("POST", "/auth/login", params);
  },

  async signup(params: {
    name: string;
    email: string;
    password: string;
    country: string;
  }): Promise<Session> {
    return request("POST", "/auth/signup", params);
  },

  async me(): Promise<User> {
    return request("GET", "/auth/me");
  },

  async logout(): Promise<void> {
    await request("POST", "/auth/logout");
  },
};



export const projectsApi = {
  async list(): Promise<Project[]> {
    return request("GET", "/projects");
  },

  async get(projectId: string): Promise<Project> {
    return request("GET", `/projects/${projectId}`);
  },

  async create(params: {
    name: string;
    slug: string;
    description?: string;
    storage_region: Project["storage_region"];
    storage_backend: Project["storage_backend"];
  }): Promise<Project> {
    return request("POST", "/projects", params);
  },

  async update(projectId: string, patch: Partial<Project>): Promise<Project> {
    return request("PATCH", `/projects/${projectId}`, patch);
  },

  async remove(projectId: string): Promise<void> {
    await request("DELETE", `/projects/${projectId}`);
  },

  async usage(projectId: string): Promise<ProjectUsage> {
    return request("GET", `/projects/${projectId}/usage`);
  },

  async stats(projectId: string): Promise<ProjectStatPoint[]> {
    return request("GET", `/projects/${projectId}/stats`);
  },
};



export const uploadsApi = {
  async list(params: UploadListParams): Promise<Page<Upload>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    if (params.folder) qs.set("folder", params.folder);
    return request("GET", `/projects/${params.project_id}/uploads?${qs}`);
  },

  async get(projectId: string, uploadId: string): Promise<Upload> {
    return request("GET", `/projects/${projectId}/uploads/${uploadId}`);
  },

  async create(params: {
    project_id: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    folder?: string;
  }): Promise<Upload> {
    const result = await request<{ upload: Upload; presigned_url: string }>(
      "POST",
      `/projects/${params.project_id}/uploads`,
      params,
    );
    // The real backend returns { upload, presigned_url }
    // For now return just the upload to match existing UI expectations.
    // The presigned_url should be used by the upload component to PUT the file.
    return result.upload;
  },

  async remove(projectId: string, uploadId: string): Promise<void> {
    await request("DELETE", `/projects/${projectId}/uploads/${uploadId}`);
  },

  async removeMany(projectId: string, uploadIds: string[]): Promise<void> {
    await request("POST", `/projects/${projectId}/uploads/batch-delete`, {
      upload_ids: uploadIds,
    });
  },

  async signedUrl(
    projectId: string,
    uploadId: string,
    expiresIn = 3600,
  ): Promise<{ url: string; expires_at: string }> {
    return request(
      "GET",
      `/projects/${projectId}/uploads/${uploadId}/url?expires_in=${expiresIn}`,
    );
  },
};



export const apiKeysApi = {
  async list(projectId: string): Promise<ApiKey[]> {
    return request("GET", `/projects/${projectId}/keys`);
  },

  async create(params: {
    project_id: string;
    name: string;
    scopes: ApiKeyScope[];
    environment: "live" | "test";
  }): Promise<ApiKey> {
    return request("POST", `/projects/${params.project_id}/keys`, params);
  },

  async revoke(projectId: string, keyId: string): Promise<void> {
    await request("DELETE", `/projects/${projectId}/keys/${keyId}`);
  },
};



export const webhooksApi = {
  async list(projectId: string): Promise<WebhookEndpoint[]> {
    return request("GET", `/projects/${projectId}/webhooks`);
  },

  async create(params: {
    project_id: string;
    url: string;
    events: WebhookEvent[];
  }): Promise<WebhookEndpoint> {
    return request("POST", `/projects/${params.project_id}/webhooks`, params);
  },

  async update(
    projectId: string,
    endpointId: string,
    patch: Partial<WebhookEndpoint>,
  ): Promise<WebhookEndpoint> {
    return request(
      "PATCH",
      `/projects/${projectId}/webhooks/${endpointId}`,
      patch,
    );
  },

  async remove(projectId: string, endpointId: string): Promise<void> {
    await request("DELETE", `/projects/${projectId}/webhooks/${endpointId}`);
  },

  async deliveries(
    projectId: string,
    endpointId: string,
  ): Promise<WebhookDelivery[]> {
    return request(
      "GET",
      `/projects/${projectId}/webhooks/${endpointId}/deliveries`,
    );
  },

  async sendTest(
    projectId: string,
    endpointId: string,
  ): Promise<WebhookDelivery> {
    return request(
      "POST",
      `/projects/${projectId}/webhooks/${endpointId}/test`,
    );
  },
};



export const billingApi = {
  async plans(): Promise<Plan[]> {
    return request("GET", "/billing/plans");
  },

  async subscription(): Promise<Subscription> {
    return request("GET", "/billing/subscription");
  },

  async invoices(): Promise<Invoice[]> {
    return request("GET", "/billing/invoices");
  },

  async changePlan(planId: SubscriptionTier): Promise<Subscription> {
    return request("POST", "/billing/change-plan", { plan_id: planId });
  },
};



export interface DashboardOverview {
  totals: {
    storage_bytes: number;
    storage_quota_bytes: number;
    bandwidth_bytes: number;
    bandwidth_quota_bytes: number;
    api_requests: number;
    api_requests_quota: number;
    file_count: number;
    project_count: number;
  };
  trend: ProjectStatPoint[];
  recent_uploads: Upload[];
}

export const dashboardApi = {
  async overview(): Promise<DashboardOverview> {
    return request("GET", "/dashboard/overview");
  },
};
