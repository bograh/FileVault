import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  value: string;
  label?: string;
  size?: "default" | "sm" | "lg" | "xl" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
}

export function CopyButton({
  value,
  label,
  size = "sm",
  variant = "outline",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard not available */
        }
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label ?? (copied ? "Copied" : "Copy")}
    </Button>
  );
}
