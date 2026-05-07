/**
 * Typed API contracts matching the eventual FileVault backend.
 * See PRD.md sections 8 and 18.
 */

// -------------------- Common --------------------

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
}

export interface Envelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  docs_url?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  next_cursor?: string | null;
}

// -------------------- User / Auth --------------------

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  country: string;
  two_factor_enabled: boolean;
  created_at: string;
}

export interface Session {
  user: User;
  expires_at: string;
}

// -------------------- Projects --------------------

export type StorageRegion = "us-east-1" | "eu-west-1" | "af-south-1";
export type StorageBackend = "s3" | "r2" | "b2" | "minio";
export type SubscriptionTier = "hobby" | "starter" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";
export type BillingProviderName = "stripe" | "paystack";

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  storage_region: StorageRegion;
  storage_backend: StorageBackend;
  bucket_prefix: string;
  max_file_size_bytes: number;
  allowed_mime_types: string[] | null;
  versioning_enabled: boolean;
  custom_domain: string | null;
  billing_provider: BillingProviderName;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectUsage {
  project_id: string;
  storage_bytes: number;
  storage_quota_bytes: number;
  bandwidth_bytes: number;
  bandwidth_quota_bytes: number;
  api_requests: number;
  api_requests_quota: number;
  file_count: number;
  period_start: string;
  period_end: string;
}

export interface ProjectStatPoint {
  date: string; // YYYY-MM-DD
  uploads: number;
  downloads: number;
  storage_bytes: number;
  bandwidth_bytes: number;
  api_requests: number;
}

// -------------------- Uploads --------------------

export type UploadStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";
export type UploadAcl = "private" | "public" | "project";

export interface Upload {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  status: UploadStatus;
  checksum_sha256: string | null;
  acl: UploadAcl;
  folder: string; // "/" at root
  metadata: Record<string, string>;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

// -------------------- API Keys --------------------

export type ApiKeyScope = "read" | "write" | "delete" | "admin";
export type ApiKeyEnvironment = "live" | "test";

export interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;
  full_key?: string; // only returned on creation
  scopes: ApiKeyScope[];
  environment: ApiKeyEnvironment;
  ip_allowlist: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// -------------------- Webhooks --------------------

export type WebhookEvent =
  | "upload.completed"
  | "upload.failed"
  | "file.deleted"
  | "quota.warning"
  | "billing.invoice.created";

export interface WebhookEndpoint {
  id: string;
  project_id: string;
  url: string;
  events: WebhookEvent[];
  secret_prefix: string;
  enabled: boolean;
  created_at: string;
}

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed";

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: WebhookEvent;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  status: WebhookDeliveryStatus;
  duration_ms: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

// -------------------- Billing --------------------

export interface Plan {
  id: SubscriptionTier;
  name: string;
  price_cents: number;
  price_label: string;
  currency: string;
  storage_gb: number | null; // null = unlimited
  bandwidth_gb: number | null;
  api_requests: number | null;
  projects: number | null;
  max_file_size_mb: number | null;
  features: string[];
  sla_percent: number | null;
  cta: string;
  highlight?: boolean;
}

export interface Subscription {
  id: string;
  plan_id: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider: BillingProviderName;
  amount_cents: number;
  currency: string;
}

export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible";

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  amount_cents: number;
  currency: string;
  period_start: string;
  period_end: string;
  issued_at: string;
  paid_at: string | null;
  hosted_url: string;
  pdf_url: string;
  line_items: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
}

// -------------------- Query Params --------------------

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface UploadListParams extends PaginationParams {
  search?: string;
  status?: UploadStatus;
  folder?: string;
  project_id: string;
}
