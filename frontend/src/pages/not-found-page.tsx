import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export function NotFoundPage() {
  const router = useRouter();
  const { user } = useAuth();
  const pathname = router.state.location.pathname;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.32_0.08_280/_0.35),_transparent_60%),radial-gradient(ellipse_at_bottom,_oklch(0.28_0.08_200/_0.25),_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.08] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          404 · Not found
        </div>

        {/* Glyph */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl" />
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-card/60 shadow-lg backdrop-blur">
            <FileQuestion className="h-9 w-9 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          This object doesn't exist
        </h1>
        <p className="mt-4 max-w-md text-balance text-muted-foreground">
          The page you're looking for may have been moved, deleted, or never
          uploaded in the first place.
        </p>

        {/* Mock S3 key */}
        <div className="mt-8 w-full">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/50 text-left shadow-sm backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/60 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>GET {pathname}</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                404 NoSuchKey
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-3 text-left font-mono text-xs leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/70">{"{"}</span>
              {"\n  "}
              <span className="text-foreground">"error"</span>:{" "}
              <span className="text-primary">"NoSuchKey"</span>,{"\n  "}
              <span className="text-foreground">"message"</span>:{" "}
              <span className="text-primary">
                "The specified key does not exist."
              </span>
              ,{"\n  "}
              <span className="text-foreground">"resource"</span>:{" "}
              <span className="text-primary">"{pathname}"</span>
              {"\n"}
              <span className="text-muted-foreground/70">{"}"}</span>
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.history.back()}
            aria-label="Go back to the previous page"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          {user ? (
            <Button asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4" />
                Back home
              </Link>
            </Button>
          )}
        </div>

        {/* Helpful links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Try instead:</span>
          {user ? (
            <>
              <NavHint to="/dashboard/projects">Projects</NavHint>
              <NavHint to="/dashboard/billing">Billing</NavHint>
              <NavHint to="/dashboard/settings">Account</NavHint>
            </>
          ) : (
            <>
              <NavHint to="/">Home</NavHint>
              <NavHint to="/signup">Create account</NavHint>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function NavHint({
  to,
  children,
}: {
  to: "/dashboard/projects" | "/dashboard/billing" | "/dashboard/settings" | "/" | "/signup";
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
    >
      {children}
    </Link>
  );
}
