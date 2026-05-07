import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 text-primary-foreground shadow-md">
              <Layers className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              FileVault
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer ? <div className="text-center text-sm">{footer}</div> : null}
          </div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border/40 md:block">
        <div
          className="absolute inset-0 -z-10 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(800px 400px at 100% 0%, color-mix(in oklch, var(--color-primary) 25%, transparent), transparent 60%), radial-gradient(600px 600px at 0% 100%, color-mix(in oklch, oklch(0.7 0.18 210) 25%, transparent), transparent 70%)",
          }}
        />
        <div className="flex h-full flex-col justify-between p-12">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="font-mono text-xs uppercase tracking-widest">
              FileVault — overview
            </p>
            <p className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
              The boring parts of file uploads, finally a product.
            </p>
            <p className="max-w-md">
              Presigned URLs, resumable transfers, virus scanning, webhooks,
              per-tenant quotas, and usage-based billing. Available in minutes.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest text-muted-foreground">
                This month
              </span>
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">
                +12.3%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Uploads" value="1.4M" />
              <Stat label="Storage" value="412 GB" />
              <Stat label="Bandwidth" value="3.7 TB" />
            </div>
            <div className="mt-4 flex h-12 items-end gap-1.5">
              {[18, 32, 24, 48, 36, 64, 50, 72, 58, 80, 66, 88].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-primary/80 to-cyan-300/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <blockquote className="text-sm text-muted-foreground">
            <p className="text-foreground">
              "Replaced 600 lines of presign + retry + webhook code with the
              FileVault SDK in an afternoon."
            </p>
            <footer className="mt-2 text-xs">
              — Lila Martens, Staff Engineer at Loomly
            </footer>
          </blockquote>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
