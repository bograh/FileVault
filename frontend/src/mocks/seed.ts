import type {
  ApiKey,
  Invoice,
  Plan,
  Project,
  ProjectStatPoint,
  ProjectUsage,
  Subscription,
  Upload,
  User,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/types/api";
import { id, randInt } from "@/lib/utils";

// Seeded-ish random to keep demo somewhat stable across a session.
let seed = 1337;
function rand(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function between(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// -------------------- User --------------------

export const currentUser: User = {
  id: "usr_01hxkcurrent0001",
  name: "Ada Asante",
  email: "ada@filevault.dev",
  avatar_url: null,
  country: "GH",
  two_factor_enabled: true,
  created_at: new Date(Date.now() - 120 * 86400_000).toISOString(),
};

// -------------------- Projects --------------------

const projectTemplates = [
  {
    name: "Acme Marketing Site",
    slug: "acme-marketing",
    description: "Landing page assets and media kit downloads.",
    tier: "starter" as const,
  },
  {
    name: "Ledger Receipts",
    slug: "ledger-receipts",
    description: "User-uploaded receipt attachments for expense tracking.",
    tier: "pro" as const,
  },
  {
    name: "Classroom Uploads",
    slug: "classroom-uploads",
    description: "Homework submissions with MIME allowlisting.",
    tier: "starter" as const,
  },
  {
    name: "Podcast Dropbox",
    slug: "podcast-dropbox",
    description: "Raw audio ingest from contributors, resumable uploads.",
    tier: "pro" as const,
  },
  {
    name: "Hobby Sandbox",
    slug: "hobby-sandbox",
    description: "Personal experiments and throwaway demos.",
    tier: "hobby" as const,
  },
];

export const projects: Project[] = projectTemplates.map((t, i) => {
  const created = Date.now() - (90 - i * 14) * 86400_000;
  return {
    id: `proj_${t.slug.replace(/-/g, "").slice(0, 10)}${i}x`,
    owner_id: currentUser.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    storage_region: pick(["us-east-1", "eu-west-1", "af-south-1"] as const),
    storage_backend: pick(["s3", "r2", "b2"] as const),
    bucket_prefix: `fv-${t.slug}`,
    max_file_size_bytes:
      t.tier === "hobby"
        ? 50 * 1024 * 1024
        : t.tier === "starter"
          ? 500 * 1024 * 1024
          : 5 * 1024 * 1024 * 1024,
    allowed_mime_types:
      i === 2 ? ["image/*", "application/pdf", "text/plain"] : null,
    versioning_enabled: t.tier === "pro",
    custom_domain: t.tier === "pro" ? `cdn.${t.slug}.io` : null,
    billing_provider: "stripe",
    subscription_tier: t.tier,
    subscription_status: "active",
    created_at: new Date(created).toISOString(),
    updated_at: new Date(created + 14 * 86400_000).toISOString(),
  };
});

// -------------------- Usage --------------------

const quotaByTier = {
  hobby: { storage: 5, bandwidth: 10, requests: 10_000, projects: 1 },
  starter: { storage: 50, bandwidth: 100, requests: 100_000, projects: 5 },
  pro: { storage: 500, bandwidth: 1000, requests: 1_000_000, projects: 25 },
  enterprise: {
    storage: null,
    bandwidth: null,
    requests: null,
    projects: null,
  },
};

function gb(n: number): number {
  return Math.round(n * 1024 * 1024 * 1024);
}

export const usageByProject: Record<string, ProjectUsage> = Object.fromEntries(
  projects.map((p) => {
    const q = quotaByTier[p.subscription_tier];
    const storageQuota = q.storage ? gb(q.storage) : gb(5000);
    const bandwidthQuota = q.bandwidth ? gb(q.bandwidth) : gb(10_000);
    const requestsQuota = q.requests ?? 100_000_000;
    const storageUsed = Math.round(storageQuota * (0.22 + rand() * 0.7));
    const bandwidthUsed = Math.round(bandwidthQuota * (0.1 + rand() * 0.6));
    const requestsUsed = Math.round(requestsQuota * (0.08 + rand() * 0.6));
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [
      p.id,
      {
        project_id: p.id,
        storage_bytes: storageUsed,
        storage_quota_bytes: storageQuota,
        bandwidth_bytes: bandwidthUsed,
        bandwidth_quota_bytes: bandwidthQuota,
        api_requests: requestsUsed,
        api_requests_quota: requestsQuota,
        file_count: between(40, 3200),
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      },
    ];
  }),
);

// -------------------- Stats (30 days) --------------------

export const statsByProject: Record<string, ProjectStatPoint[]> =
  Object.fromEntries(
    projects.map((p) => {
      const points: ProjectStatPoint[] = [];
      const baseUploads = between(40, 250);
      const baseBandwidth = gb(between(1, 20));
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000);
        const wave = 1 + Math.sin((29 - i) / 4) * 0.35;
        points.push({
          date: d.toISOString().slice(0, 10),
          uploads: Math.round(baseUploads * wave * (0.6 + rand() * 0.8)),
          downloads: Math.round(
            baseUploads * wave * (1.8 + rand() * 1.5) * 0.8,
          ),
          storage_bytes: Math.round(
            gb(between(1, 40)) * wave * (0.7 + rand() * 0.6),
          ),
          bandwidth_bytes: Math.round(baseBandwidth * wave * (0.5 + rand())),
          api_requests: Math.round(
            between(500, 5000) * wave * (0.7 + rand() * 1.3),
          ),
        });
      }
      return [p.id, points];
    }),
  );

// -------------------- Uploads --------------------

const fileSamples: Array<{
  filename: string;
  content_type: string;
  size: number;
}> = [
  { filename: "hero-banner.png", content_type: "image/png", size: 1_245_310 },
  {
    filename: "q3-financials.pdf",
    content_type: "application/pdf",
    size: 3_402_112,
  },
  {
    filename: "podcast-ep-42.mp3",
    content_type: "audio/mpeg",
    size: 84_221_345,
  },
  { filename: "team-photo.jpg", content_type: "image/jpeg", size: 2_811_920 },
  {
    filename: "launch-video.mp4",
    content_type: "video/mp4",
    size: 412_998_112,
  },
  {
    filename: "dataset-users.csv",
    content_type: "text/csv",
    size: 23_119_003,
  },
  { filename: "logo.svg", content_type: "image/svg+xml", size: 11_200 },
  {
    filename: "contract.docx",
    content_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 452_031,
  },
  {
    filename: "archive-2025.zip",
    content_type: "application/zip",
    size: 1_221_004_998,
  },
  { filename: "invoice-2026-04.pdf", content_type: "application/pdf", size: 87_104 },
  {
    filename: "onboarding-deck.pptx",
    content_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size: 18_554_120,
  },
  {
    filename: "sprint-demo.webm",
    content_type: "video/webm",
    size: 234_119_301,
  },
  { filename: "robots.txt", content_type: "text/plain", size: 112 },
  { filename: "favicon.ico", content_type: "image/x-icon", size: 4_120 },
  {
    filename: "user-avatar-12.jpg",
    content_type: "image/jpeg",
    size: 145_200,
  },
];

const folders = [
  "/",
  "/marketing",
  "/marketing/blog",
  "/receipts/2026",
  "/avatars",
  "/raw",
  "/exports",
];

export const uploads: Upload[] = projects.flatMap((p) => {
  const count = between(35, 90);
  const list: Upload[] = [];
  for (let i = 0; i < count; i++) {
    const sample = pick(fileSamples);
    const createdAt = new Date(
      Date.now() - between(1, 60 * 86400) * 1000,
    ).toISOString();
    const status: Upload["status"] = pick([
      "completed",
      "completed",
      "completed",
      "completed",
      "processing",
      "pending",
      "failed",
    ]);
    const folder = pick(folders);
    const uploadId = id("upl");
    list.push({
      id: uploadId,
      project_id: p.id,
      filename: sample.filename,
      content_type: sample.content_type,
      size_bytes: Math.round(sample.size * (0.6 + rand() * 1.6)),
      storage_key: `${p.bucket_prefix}/2026/05/${uploadId}/${sample.filename}`,
      status,
      checksum_sha256:
        status === "completed"
          ? Array.from({ length: 64 }, () =>
              "0123456789abcdef"[Math.floor(rand() * 16)],
            ).join("")
          : null,
      acl: pick(["private", "private", "private", "public", "project"] as const),
      folder,
      metadata: {},
      created_at: createdAt,
      completed_at:
        status === "completed"
          ? new Date(Date.parse(createdAt) + between(500, 60_000)).toISOString()
          : null,
      deleted_at: null,
    });
  }
  return list;
});

// -------------------- API Keys --------------------

export const apiKeys: ApiKey[] = projects.flatMap((p) => {
  const keys: ApiKey[] = [];
  const n = between(1, 3);
  for (let i = 0; i < n; i++) {
    const env = pick(["live", "test"] as const);
    const prefix = `fv_${env}_${Array.from({ length: 6 }, () =>
      "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)],
    ).join("")}`;
    keys.push({
      id: id("key"),
      project_id: p.id,
      name: pick([
        "Production server",
        "CI runner",
        "Staging key",
        "Mobile app",
        "Analytics pipeline",
      ]),
      key_prefix: prefix,
      scopes: pick([
        ["read", "write"] as const,
        ["read", "write", "delete"] as const,
        ["read"] as const,
        ["admin"] as const,
      ]).slice() as ApiKey["scopes"],
      environment: env,
      ip_allowlist: [],
      last_used_at: new Date(
        Date.now() - between(1, 72) * 3600_000,
      ).toISOString(),
      expires_at: null,
      revoked_at: null,
      created_at: new Date(
        Date.now() - between(10, 180) * 86400_000,
      ).toISOString(),
    });
  }
  return keys;
});

// -------------------- Webhooks --------------------

export const webhookEndpoints: WebhookEndpoint[] = projects.flatMap((p) => {
  const list: WebhookEndpoint[] = [];
  const n = between(0, 2);
  for (let i = 0; i < n; i++) {
    list.push({
      id: id("wh"),
      project_id: p.id,
      url: `https://${p.slug}.example.com/webhooks/filevault`,
      events: pick([
        ["upload.completed", "upload.failed"] as const,
        ["upload.completed", "file.deleted", "quota.warning"] as const,
        ["upload.completed"] as const,
      ]).slice() as WebhookEndpoint["events"],
      secret_prefix: "whsec_" + Array.from({ length: 6 }, () =>
        "abcdef0123456789"[Math.floor(rand() * 16)],
      ).join(""),
      enabled: pick([true, true, true, false]),
      created_at: new Date(
        Date.now() - between(5, 120) * 86400_000,
      ).toISOString(),
    });
  }
  return list;
});

export const webhookDeliveries: WebhookDelivery[] = webhookEndpoints.flatMap(
  (wh) => {
    const list: WebhookDelivery[] = [];
    const n = between(8, 25);
    for (let i = 0; i < n; i++) {
      const status = pick([
        "succeeded",
        "succeeded",
        "succeeded",
        "succeeded",
        "failed",
        "pending",
      ]) as WebhookDelivery["status"];
      list.push({
        id: id("whd"),
        endpoint_id: wh.id,
        event_type: pick(wh.events),
        response_status:
          status === "succeeded" ? 200 : status === "failed" ? 500 : null,
        response_body:
          status === "succeeded"
            ? '{"received":true}'
            : status === "failed"
              ? "Internal Server Error"
              : null,
        attempt_count:
          status === "succeeded" ? 1 : status === "failed" ? between(2, 5) : 1,
        status,
        duration_ms: between(42, 1800),
        next_retry_at:
          status === "failed"
            ? new Date(Date.now() + between(60, 3600) * 1000).toISOString()
            : null,
        delivered_at:
          status === "succeeded"
            ? new Date(
                Date.now() - between(1, 72) * 3600_000,
              ).toISOString()
            : null,
        created_at: new Date(
          Date.now() - between(1, 168) * 3600_000,
        ).toISOString(),
      });
    }
    return list;
  },
);

// -------------------- Billing --------------------

export const plans: Plan[] = [
  {
    id: "hobby",
    name: "Hobby",
    price_cents: 0,
    price_label: "Free",
    currency: "USD",
    storage_gb: 5,
    bandwidth_gb: 10,
    api_requests: 10_000,
    projects: 1,
    max_file_size_mb: 50,
    features: [
      "1 project",
      "50 MB max file size",
      "Community support",
      "Standard uploads",
    ],
    sla_percent: null,
    cta: "Current plan",
  },
  {
    id: "starter",
    name: "Starter",
    price_cents: 1900,
    price_label: "$19",
    currency: "USD",
    storage_gb: 50,
    bandwidth_gb: 100,
    api_requests: 100_000,
    projects: 5,
    max_file_size_mb: 500,
    features: [
      "5 projects",
      "500 MB max file size",
      "Webhooks",
      "Email support",
      "99.5% SLA",
    ],
    sla_percent: 99.5,
    cta: "Upgrade to Starter",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price_cents: 7900,
    price_label: "$79",
    currency: "USD",
    storage_gb: 500,
    bandwidth_gb: 1000,
    api_requests: 1_000_000,
    projects: 25,
    max_file_size_mb: 5000,
    features: [
      "25 projects",
      "5 GB max file size",
      "Custom domains",
      "File versioning",
      "Priority support",
      "99.9% SLA",
    ],
    sla_percent: 99.9,
    cta: "Upgrade to Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_cents: 0,
    price_label: "Custom",
    currency: "USD",
    storage_gb: null,
    bandwidth_gb: null,
    api_requests: null,
    projects: null,
    max_file_size_mb: null,
    features: [
      "Unlimited everything",
      "SSO (SAML / OIDC)",
      "Audit logs",
      "Dedicated support",
      "99.99% SLA",
      "Data residency",
    ],
    sla_percent: 99.99,
    cta: "Contact sales",
  },
];

export const subscription: Subscription = {
  id: id("sub"),
  plan_id: "starter",
  status: "active",
  current_period_start: new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString(),
  current_period_end: new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).toISOString(),
  cancel_at_period_end: false,
  provider: "stripe",
  amount_cents: 1900,
  currency: "USD",
};

export const invoices: Invoice[] = Array.from({ length: 8 }, (_, i) => {
  const monthsAgo = i;
  const d = new Date();
  const periodStart = new Date(
    d.getFullYear(),
    d.getMonth() - monthsAgo - 1,
    1,
  );
  const periodEnd = new Date(d.getFullYear(), d.getMonth() - monthsAgo, 0);
  const base = 1900;
  const overage = monthsAgo === 0 ? 0 : Math.round(rand() * 1200);
  const total = base + overage;
  return {
    id: id("in"),
    number: `FV-${2026}${String(d.getMonth() - monthsAgo).padStart(2, "0")}-${randInt(
      1000,
      9999,
    )}`,
    status: i === 0 ? "open" : "paid",
    amount_cents: total,
    currency: "USD",
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    issued_at: new Date(periodEnd).toISOString(),
    paid_at:
      i === 0
        ? null
        : new Date(
            periodEnd.getTime() + 2 * 86400_000,
          ).toISOString(),
    hosted_url: "#",
    pdf_url: "#",
    line_items: [
      {
        description: "Starter plan — monthly",
        quantity: 1,
        unit_amount_cents: base,
        amount_cents: base,
      },
      ...(overage
        ? [
            {
              description: "Bandwidth overage",
              quantity: Math.ceil(overage / 9),
              unit_amount_cents: 9,
              amount_cents: overage,
            },
          ]
        : []),
    ],
  };
});
