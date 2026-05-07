import { CheckCircle2, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  useChangePlan,
  useInvoices,
  usePlans,
  useSubscription,
} from "@/features/billing/hooks";
import { useDashboardOverview } from "@/features/projects/hooks";
import { formatBytes, formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceStatus, Plan, SubscriptionTier } from "@/types/api";

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "success" | "warning" | "muted" | "destructive"
> = {
  paid: "success",
  open: "warning",
  void: "muted",
  uncollectible: "destructive",
};

export function BillingPage() {
  const { data: plans } = usePlans();
  const { data: sub } = useSubscription();
  const { data: invoices } = useInvoices();
  const { data: overview } = useDashboardOverview();
  const change = useChangePlan();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Plan & invoices"
        description="Usage-based pricing with automatic provider routing — Stripe globally, Paystack across Africa."
      />

      <Card>
        <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              Plans renew on the 1st of each month.
            </CardDescription>
          </div>
          {sub ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {sub.plan_id} · {formatCurrency(sub.amount_cents)} / mo
              </Badge>
              <Badge variant="outline">via {sub.provider}</Badge>
              <Badge
                variant={sub.status === "active" ? "success" : "warning"}
              >
                {sub.status}
              </Badge>
            </div>
          ) : (
            <Skeleton className="h-7 w-44" />
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {!overview ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : (
            <>
              <UsageBar
                label="Storage"
                used={formatBytes(overview.totals.storage_bytes)}
                limit={formatBytes(overview.totals.storage_quota_bytes)}
                pct={
                  (overview.totals.storage_bytes /
                    overview.totals.storage_quota_bytes) *
                  100
                }
              />
              <UsageBar
                label="Bandwidth"
                used={formatBytes(overview.totals.bandwidth_bytes)}
                limit={formatBytes(overview.totals.bandwidth_quota_bytes)}
                pct={
                  (overview.totals.bandwidth_bytes /
                    overview.totals.bandwidth_quota_bytes) *
                  100
                }
              />
              <UsageBar
                label="API requests"
                used={formatNumber(overview.totals.api_requests)}
                limit={formatNumber(overview.totals.api_requests_quota)}
                pct={
                  (overview.totals.api_requests /
                    overview.totals.api_requests_quota) *
                  100
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compare plans</CardTitle>
          <CardDescription>Upgrade or downgrade anytime.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!plans ? (
            <>
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </>
          ) : (
            plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                isCurrent={sub?.plan_id === p.id}
                isLoading={change.isPending}
                onSelect={async () => {
                  if (sub?.plan_id === p.id) return;
                  try {
                    await change.mutateAsync(p.id as SubscriptionTier);
                    toast.success(`Switched to ${p.name}`);
                  } catch (err) {
                    toast.error("Switch failed", {
                      description:
                        err instanceof Error ? err.message : undefined,
                    });
                  }
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Last 8 billing periods.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!invoices ? (
            <div className="space-y-2 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Number</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-5 font-mono text-xs">
                      {inv.number}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(inv.period_start, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      –{" "}
                      {formatDate(inv.period_end, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(inv.amount_cents, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(inv.issued_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={inv.hosted_url}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={inv.pdf_url}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  pct,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const tone =
    clamped >= 90
      ? "bg-destructive"
      : clamped >= 70
        ? "bg-warning"
        : "bg-primary";
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used}{" "}
          <span className="text-muted-foreground">/ {limit}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isLoading,
  onSelect,
}: {
  plan: Plan;
  isCurrent: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-5",
        plan.highlight
          ? "border-primary/50 bg-primary/[0.06]"
          : "border-border/60 bg-card/40",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{plan.name}</h3>
        {plan.highlight ? <Badge>Popular</Badge> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight">
          {plan.price_label}
        </span>
        {plan.price_cents > 0 ? (
          <span className="text-xs text-muted-foreground">/ month</span>
        ) : null}
      </div>
      <ul className="mt-4 flex-1 space-y-1.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-5 w-full"
        variant={isCurrent ? "outline" : plan.highlight ? "default" : "secondary"}
        disabled={isCurrent || isLoading}
        onClick={onSelect}
      >
        {isLoading && !isCurrent ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {isCurrent ? "Current plan" : plan.cta}
      </Button>
    </div>
  );
}
