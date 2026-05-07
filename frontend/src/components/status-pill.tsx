import type { UploadStatus, WebhookDeliveryStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";

const uploadMap: Record<
  UploadStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "muted" }
> = {
  pending: { label: "Pending", variant: "muted" },
  processing: { label: "Processing", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  deleted: { label: "Deleted", variant: "muted" },
};

export function UploadStatusBadge({ status }: { status: UploadStatus }) {
  const cfg = uploadMap[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const webhookMap: Record<
  WebhookDeliveryStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  succeeded: { label: "Delivered", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  failed: { label: "Failed", variant: "destructive" },
};

export function WebhookStatusBadge({
  status,
}: {
  status: WebhookDeliveryStatus;
}) {
  const cfg = webhookMap[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
