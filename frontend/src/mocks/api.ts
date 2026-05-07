/**
 * Mock API — mirrors the eventual HTTP client shape.
 *
 * All functions return Promises with simulated latency and occasional errors.
 * When the real backend is ready, swap the implementations in
 * `src/services/*.ts` with `fetch`-based calls using the same contracts.
 *
 * Toggle `MOCK_OPTIONS.errorRate` to simulate failures for UI testing.
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
import { id, sleep } from "@/lib/utils";
import {
  apiKeys,
  currentUser,
  invoices,
  plans,
  projects,
  statsByProject,
  subscription,
  uploads,
  usageByProject,
  webhookDeliveries,
  webhookEndpoints,
} from "./seed";

export const MOCK_OPTIONS = {
  minLatencyMs: 180,
  maxLatencyMs: 520,
  /** 0..1 probability each mutation randomly fails. 0 = never. */
  errorRate: 0,
};

async function simulate<T>(value: T): Promise<T> {
  const ms =
    MOCK_OPTIONS.minLatencyMs +
    Math.random() * (MOCK_OPTIONS.maxLatencyMs - MOCK_OPTIONS.minLatencyMs);
  await sleep(ms);
  if (MOCK_OPTIONS.errorRate > 0 && Math.random() < MOCK_OPTIONS.errorRate) {
    throw new MockApiError(
      "INTERNAL_ERROR",
      "Simulated failure for testing error states.",
    );
  }
  return value;
}

export class MockApiError extends Error {
  code: string;
  docs_url?: string;
  constructor(code: string, message: string, docs_url?: string) {
    super(message);
    this.code = code;
    this.docs_url = docs_url;
  }
}

// Mutable in-memory clones so UI mutations feel "real" during a session.
const db = {
  projects: [...projects],
  uploads: [...uploads],
  apiKeys: [...apiKeys],
  webhookEndpoints: [...webhookEndpoints],
  webhookDeliveries: [...webhookDeliveries],
  subscription: { ...subscription },
};

function paginate<T>(
  arr: T[],
  page = 1,
  pageSize = 20,
): Page<T> {
  const total = arr.length;
  const start = (page - 1) * pageSize;
  const items = arr.slice(start, start + pageSize);
  return {
    items,
    total,
    page,
    page_size: pageSize,
    has_more: start + pageSize < total,
    next_cursor: start + pageSize < total ? String(page + 1) : null,
  };
}



export const authApi = {
  async login(params: {
    email: string;
    password: string;
    totp_code?: string;
  }): Promise<Session | { requires_2fa: true; challenge_id: string }> {
    await sleep(600);
    if (!params.email || !params.password) {
      throw new MockApiError("INVALID_CREDENTIALS", "Invalid email or password.");
    }
    if (!params.totp_code) {
      return { requires_2fa: true, challenge_id: id("chl") };
    }
    if (params.totp_code.length !== 6) {
      throw new MockApiError(
        "INVALID_2FA_CODE",
        "Authentication code must be 6 digits.",
      );
    }
    return simulate({
      user: currentUser,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    });
  },

  async signup(params: {
    name: string;
    email: string;
    password: string;
    country: string;
  }): Promise<Session> {
    await sleep(800);
    if (!params.email.includes("@")) {
      throw new MockApiError("INVALID_EMAIL", "Please enter a valid email.");
    }
    return simulate({
      user: { ...currentUser, name: params.name, email: params.email },
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    });
  },

  async me(): Promise<User> {
    return simulate(currentUser);
  },

  async logout(): Promise<void> {
    await sleep(120);
  },
};



export const projectsApi = {
  async list(): Promise<Project[]> {
    return simulate([...db.projects]);
  },

  async get(projectId: string): Promise<Project> {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) throw new MockApiError("NOT_FOUND", "Project not found.");
    return simulate(p);
  },

  async create(params: {
    name: string;
    slug: string;
    description?: string;
    storage_region: Project["storage_region"];
    storage_backend: Project["storage_backend"];
  }): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: id("proj"),
      owner_id: currentUser.id,
      name: params.name,
      slug: params.slug,
      description: params.description ?? "",
      storage_region: params.storage_region,
      storage_backend: params.storage_backend,
      bucket_prefix: `fv-${params.slug}`,
      max_file_size_bytes: 500 * 1024 * 1024,
      allowed_mime_types: null,
      versioning_enabled: false,
      custom_domain: null,
      billing_provider: "stripe",
      subscription_tier: "hobby",
      subscription_status: "active",
      created_at: now,
      updated_at: now,
    };
    db.projects = [project, ...db.projects];
    // Seed minimal usage for the new project so downstream views work.
    usageByProject[project.id] = {
      project_id: project.id,
      storage_bytes: 0,
      storage_quota_bytes: 5 * 1024 * 1024 * 1024,
      bandwidth_bytes: 0,
      bandwidth_quota_bytes: 10 * 1024 * 1024 * 1024,
      api_requests: 0,
      api_requests_quota: 10_000,
      file_count: 0,
      period_start: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString(),
      period_end: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0,
      ).toISOString(),
    };
    statsByProject[project.id] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400_000)
        .toISOString()
        .slice(0, 10),
      uploads: 0,
      downloads: 0,
      storage_bytes: 0,
      bandwidth_bytes: 0,
      api_requests: 0,
    }));
    return simulate(project);
  },

  async update(
    projectId: string,
    patch: Partial<Project>,
  ): Promise<Project> {
    const idx = db.projects.findIndex((x) => x.id === projectId);
    if (idx < 0) throw new MockApiError("NOT_FOUND", "Project not found.");
    const updated = {
      ...db.projects[idx]!,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    db.projects = [
      ...db.projects.slice(0, idx),
      updated,
      ...db.projects.slice(idx + 1),
    ];
    return simulate(updated);
  },

  async remove(projectId: string): Promise<void> {
    db.projects = db.projects.filter((x) => x.id !== projectId);
    db.uploads = db.uploads.filter((x) => x.project_id !== projectId);
    db.apiKeys = db.apiKeys.filter((x) => x.project_id !== projectId);
    db.webhookEndpoints = db.webhookEndpoints.filter(
      (x) => x.project_id !== projectId,
    );
    await simulate(undefined);
  },

  async usage(projectId: string): Promise<ProjectUsage> {
    const u = usageByProject[projectId];
    if (!u) throw new MockApiError("NOT_FOUND", "Usage not found.");
    return simulate(u);
  },

  async stats(projectId: string): Promise<ProjectStatPoint[]> {
    const s = statsByProject[projectId];
    if (!s) throw new MockApiError("NOT_FOUND", "Stats not found.");
    return simulate(s);
  },
};



export const uploadsApi = {
  async list(params: UploadListParams): Promise<Page<Upload>> {
    const { project_id, search = "", status, folder, page = 1, page_size = 20 } =
      params;
    let items = db.uploads.filter((u) => u.project_id === project_id);
    if (status) items = items.filter((u) => u.status === status);
    if (folder) items = items.filter((u) => u.folder === folder);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (u) =>
          u.filename.toLowerCase().includes(q) ||
          u.content_type.toLowerCase().includes(q),
      );
    }
    items.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return simulate(paginate(items, page, page_size));
  },

  async get(projectId: string, uploadId: string): Promise<Upload> {
    const u = db.uploads.find(
      (x) => x.id === uploadId && x.project_id === projectId,
    );
    if (!u) throw new MockApiError("NOT_FOUND", "Upload not found.");
    return simulate(u);
  },

  async create(params: {
    project_id: string;
    filename: string;
    content_type: string;
    size_bytes: number;
    folder?: string;
  }): Promise<Upload> {
    const project = db.projects.find((p) => p.id === params.project_id);
    if (!project) throw new MockApiError("NOT_FOUND", "Project not found.");
    const uploadId = id("upl");
    const upload: Upload = {
      id: uploadId,
      project_id: params.project_id,
      filename: params.filename,
      content_type: params.content_type,
      size_bytes: params.size_bytes,
      storage_key: `${project.bucket_prefix}/2026/05/${uploadId}/${params.filename}`,
      status: "processing",
      checksum_sha256: null,
      acl: "private",
      folder: params.folder ?? "/",
      metadata: {},
      created_at: new Date().toISOString(),
      completed_at: null,
      deleted_at: null,
    };
    db.uploads = [upload, ...db.uploads];
    // After a brief delay, mark as completed.
    setTimeout(() => {
      const idx = db.uploads.findIndex((u) => u.id === upload.id);
      if (idx >= 0) {
        db.uploads[idx] = {
          ...db.uploads[idx]!,
          status: "completed",
          completed_at: new Date().toISOString(),
          checksum_sha256: Array.from({ length: 64 }, () =>
            "0123456789abcdef"[Math.floor(Math.random() * 16)],
          ).join(""),
        };
      }
    }, 1400);
    return simulate(upload);
  },

  async remove(projectId: string, uploadId: string): Promise<void> {
    db.uploads = db.uploads.filter(
      (u) => !(u.id === uploadId && u.project_id === projectId),
    );
    await simulate(undefined);
  },

  async removeMany(projectId: string, uploadIds: string[]): Promise<void> {
    const set = new Set(uploadIds);
    db.uploads = db.uploads.filter(
      (u) => !(u.project_id === projectId && set.has(u.id)),
    );
    await simulate(undefined);
  },

  async signedUrl(
    _projectId: string,
    uploadId: string,
    expiresIn = 3600,
  ): Promise<{ url: string; expires_at: string }> {
    return simulate({
      url: `https://cdn.filevault.io/${uploadId}?sig=mock_${id("sig")}&exp=${Date.now() / 1000 + expiresIn}`,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  },
};



export const apiKeysApi = {
  async list(projectId: string): Promise<ApiKey[]> {
    return simulate(db.apiKeys.filter((k) => k.project_id === projectId));
  },

  async create(params: {
    project_id: string;
    name: string;
    scopes: ApiKeyScope[];
    environment: "live" | "test";
  }): Promise<ApiKey> {
    const plaintext = `fv_${params.environment}_${Array.from(
      { length: 40 },
      () =>
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
          Math.floor(Math.random() * 62)
        ],
    ).join("")}`;
    const key: ApiKey = {
      id: id("key"),
      project_id: params.project_id,
      name: params.name,
      key_prefix: plaintext.slice(0, 11),
      full_key: plaintext,
      scopes: params.scopes,
      environment: params.environment,
      ip_allowlist: [],
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    };
    db.apiKeys = [key, ...db.apiKeys];
    return simulate(key);
  },

  async revoke(projectId: string, keyId: string): Promise<void> {
    const idx = db.apiKeys.findIndex(
      (k) => k.id === keyId && k.project_id === projectId,
    );
    if (idx < 0) throw new MockApiError("NOT_FOUND", "API key not found.");
    db.apiKeys[idx] = {
      ...db.apiKeys[idx]!,
      revoked_at: new Date().toISOString(),
    };
    await simulate(undefined);
  },
};



export const webhooksApi = {
  async list(projectId: string): Promise<WebhookEndpoint[]> {
    return simulate(
      db.webhookEndpoints.filter((w) => w.project_id === projectId),
    );
  },

  async create(params: {
    project_id: string;
    url: string;
    events: WebhookEvent[];
  }): Promise<WebhookEndpoint> {
    const endpoint: WebhookEndpoint = {
      id: id("wh"),
      project_id: params.project_id,
      url: params.url,
      events: params.events,
      secret_prefix: "whsec_" + id("").slice(0, 6),
      enabled: true,
      created_at: new Date().toISOString(),
    };
    db.webhookEndpoints = [endpoint, ...db.webhookEndpoints];
    return simulate(endpoint);
  },

  async update(
    projectId: string,
    endpointId: string,
    patch: Partial<WebhookEndpoint>,
  ): Promise<WebhookEndpoint> {
    const idx = db.webhookEndpoints.findIndex(
      (w) => w.id === endpointId && w.project_id === projectId,
    );
    if (idx < 0) throw new MockApiError("NOT_FOUND", "Webhook not found.");
    db.webhookEndpoints[idx] = { ...db.webhookEndpoints[idx]!, ...patch };
    return simulate(db.webhookEndpoints[idx]!);
  },

  async remove(projectId: string, endpointId: string): Promise<void> {
    db.webhookEndpoints = db.webhookEndpoints.filter(
      (w) => !(w.id === endpointId && w.project_id === projectId),
    );
    db.webhookDeliveries = db.webhookDeliveries.filter(
      (d) => d.endpoint_id !== endpointId,
    );
    await simulate(undefined);
  },

  async deliveries(
    _projectId: string,
    endpointId: string,
  ): Promise<WebhookDelivery[]> {
    const list = db.webhookDeliveries
      .filter((d) => d.endpoint_id === endpointId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return simulate(list);
  },

  async sendTest(
    _projectId: string,
    endpointId: string,
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: id("whd"),
      endpoint_id: endpointId,
      event_type: "upload.completed",
      response_status: 200,
      response_body: '{"received":true}',
      attempt_count: 1,
      status: "succeeded",
      duration_ms: 142,
      next_retry_at: null,
      delivered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    db.webhookDeliveries = [delivery, ...db.webhookDeliveries];
    return simulate(delivery);
  },
};



export const billingApi = {
  async plans(): Promise<Plan[]> {
    return simulate(plans);
  },

  async subscription(): Promise<Subscription> {
    return simulate(db.subscription);
  },

  async invoices(): Promise<Invoice[]> {
    return simulate(invoices);
  },

  async changePlan(planId: SubscriptionTier): Promise<Subscription> {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new MockApiError("NOT_FOUND", "Plan not found.");
    db.subscription = {
      ...db.subscription,
      plan_id: planId,
      amount_cents: plan.price_cents,
    };
    return simulate(db.subscription);
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
    const projectList = db.projects;
    const usages = projectList.map((p) => usageByProject[p.id]!);
    const totals = usages.reduce(
      (acc, u) => {
        acc.storage_bytes += u.storage_bytes;
        acc.storage_quota_bytes += u.storage_quota_bytes;
        acc.bandwidth_bytes += u.bandwidth_bytes;
        acc.bandwidth_quota_bytes += u.bandwidth_quota_bytes;
        acc.api_requests += u.api_requests;
        acc.api_requests_quota += u.api_requests_quota;
        acc.file_count += u.file_count;
        return acc;
      },
      {
        storage_bytes: 0,
        storage_quota_bytes: 0,
        bandwidth_bytes: 0,
        bandwidth_quota_bytes: 0,
        api_requests: 0,
        api_requests_quota: 0,
        file_count: 0,
        project_count: projectList.length,
      },
    );

    // Merge per-project stats into a single 30-day trend.
    const byDate = new Map<string, ProjectStatPoint>();
    for (const p of projectList) {
      for (const pt of statsByProject[p.id] ?? []) {
        const existing = byDate.get(pt.date);
        if (!existing) {
          byDate.set(pt.date, { ...pt });
        } else {
          existing.uploads += pt.uploads;
          existing.downloads += pt.downloads;
          existing.storage_bytes += pt.storage_bytes;
          existing.bandwidth_bytes += pt.bandwidth_bytes;
          existing.api_requests += pt.api_requests;
        }
      }
    }
    const trend = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const recent = [...db.uploads]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 8);

    return simulate({
      totals,
      trend,
      recent_uploads: recent,
    });
  },
};
