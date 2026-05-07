import type { ReactNode, ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: number; label?: string };
  icon?: ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "danger";
  footer?: ReactNode;
  className?: string;
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/15 text-primary ring-primary/20",
  success: "bg-success/15 text-success ring-success/20",
  warning: "bg-warning/15 text-warning ring-warning/20",
  danger: "bg-destructive/15 text-destructive ring-destructive/20",
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  accent = "primary",
  footer,
  className,
}: StatCardProps) {
  const isUp = (delta?.value ?? 0) >= 0;
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
                accentMap[accent],
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </div>
        {delta ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium",
              isUp ? "text-success" : "text-destructive",
            )}
          >
            {isUp ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(delta.value).toFixed(1)}%
            {delta.label ? (
              <span className="text-muted-foreground">{delta.label}</span>
            ) : null}
          </div>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
