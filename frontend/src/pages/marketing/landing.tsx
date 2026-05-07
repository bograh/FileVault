import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Code2,
  Globe2,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <Hero />
      <Logos />
      <Features />
      <CodeShowcase />
      <Pricing />
      <FAQ />
      <FooterCta />
      <SiteFooter />
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400 text-primary-foreground shadow-md">
            <Layers className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            FileVault
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          <a
            href="#features"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="https://docs.filevault.io"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </a>
          <a
            href="#faq"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login" search={{ redirect: undefined }}>Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 grid-fade-mask opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center md:pt-32">
        <Badge variant="outline" className="mb-6 inline-flex">
          <Sparkles className="h-3 w-3" />
          Now in private beta — invite codes available
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          File uploads, the boring{" "}
          <span className="bg-gradient-to-br from-primary via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            parts done right.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          FileVault is a developer-first, S3-powered upload service. Presigned
          URLs, resumable transfers, virus scanning, webhooks, and per-tenant
          quotas — without the boilerplate.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="xl" asChild>
            <Link to="/signup">
              Start uploading <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <a href="https://docs.filevault.io">View docs</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Free Hobby tier. No credit card required.
        </p>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-border/70 bg-card/40 p-2 shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="rounded-xl bg-gradient-to-br from-card via-card/80 to-background p-4 ring-1 ring-border/60">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-border/60 bg-card/60 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Storage
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">128.4</span>
          <span className="text-sm text-muted-foreground">GB / 500 GB</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[26%] rounded-full bg-gradient-to-r from-primary to-cyan-400" />
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/60 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Bandwidth
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">412.1</span>
          <span className="text-sm text-muted-foreground">GB this month</span>
        </div>
        <div className="mt-3 flex h-12 items-end gap-1.5">
          {[24, 38, 18, 56, 42, 70, 48, 62, 72, 88, 60, 78].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-primary/80 to-cyan-300/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/60 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          API requests
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold">624,182</span>
          <span className="text-sm text-success">+12.3%</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex justify-between">
            <span>POST /uploads</span>
            <span className="text-foreground">412k</span>
          </li>
          <li className="flex justify-between">
            <span>GET /uploads/:id/url</span>
            <span className="text-foreground">141k</span>
          </li>
          <li className="flex justify-between">
            <span>DELETE /uploads/:id</span>
            <span className="text-foreground">71k</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: CloudUpload,
    title: "Presigned uploads",
    body: "Upload directly from the client to S3 — no proxying through your servers. 15-minute URLs with single-use validation.",
  },
  {
    icon: Zap,
    title: "Resumable & multipart",
    body: "TUS-compatible resumable uploads for large files. Chunk in parallel and resume from any device on connection drops.",
  },
  {
    icon: Webhook,
    title: "Real-time webhooks",
    body: "Subscribe to upload.completed, file.deleted, quota.warning. HMAC-signed payloads with retry + delivery log.",
  },
  {
    icon: KeyRound,
    title: "Granular API keys",
    body: "Per-project keys scoped to read / write / delete / admin. Rotate anytime. IP allowlists supported.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in security",
    body: "MIME magic-byte inspection, optional ClamAV scanning, AES-256 at rest, per-project CORS, rate-limited APIs.",
  },
  {
    icon: Globe2,
    title: "Multi-region & BYO bucket",
    body: "us-east-1, eu-west-1, af-south-1, or bring your own R2/B2/MinIO. Custom domain on Pro and above.",
  },
];

function Features() {
  return (
    <section id="features" className="border-t border-border/40 bg-card/20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3">
            Why FileVault
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            The upload pipeline you keep building, finally a product.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop reinventing presigned URLs, MIME validation, retries, and
            webhook delivery. FileVault handles the unsexy parts so your team
            can ship.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border/60 bg-card/50 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/70"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeShowcase() {
  return (
    <section className="border-t border-border/40 py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2 md:items-center">
        <div>
          <Badge variant="outline" className="mb-3">
            <Code2 className="h-3 w-3" />
            5-minute integration
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Type-safe SDKs for the languages you actually use.
          </h2>
          <p className="mt-4 text-muted-foreground">
            JavaScript, Go, and Python at launch. Identical primitives across
            all SDKs. Configurable retry, progress callbacks, and built-in
            error classes that map to the API error catalog.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Direct browser uploads with project tokens",
              "Streaming uploads for large files",
              "Automatic retry with exponential backoff",
              "OpenAPI 3.1 spec for any other language",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <Button asChild>
              <a href="https://docs.filevault.io">Read the docs</a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signup">Get an API key</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-1 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              upload.ts
            </span>
            <span className="w-12" />
          </div>
          <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed text-foreground/90">
            <code>{`import { FileVault } from '@filevault/sdk';

const fv = new FileVault({ apiKey: process.env.FV_KEY });

const upload = await fv
  .projects('proj_acme_2026')
  .uploads.create({
    file,
    filename: 'report.pdf',
    onProgress: (pct) => console.log(\`\${pct}%\`),
  });

const url = await fv
  .projects('proj_acme_2026')
  .uploads.getUrl(upload.id, { expiresIn: 3600 });

return Response.redirect(url);`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

const TIERS = [
  {
    name: "Hobby",
    price: "$0",
    note: "Free forever",
    features: ["1 project", "5 GB storage", "10 GB bandwidth", "Community support"],
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "$19",
    note: "per month",
    features: [
      "5 projects",
      "50 GB storage",
      "100 GB bandwidth",
      "Webhooks + email support",
    ],
    cta: "Choose Starter",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$79",
    note: "per month",
    features: [
      "25 projects",
      "500 GB storage",
      "1 TB bandwidth",
      "Custom domains + versioning",
    ],
    cta: "Choose Pro",
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "Talk to sales",
    features: ["Unlimited", "SSO + audit logs", "Data residency", "99.99% SLA"],
    cta: "Contact sales",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/40 bg-card/20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-3">
            Pricing
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Predictable, usage-based pricing.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Stripe globally, Paystack across Africa. Overages billed
            transparently — never a surprise invoice.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`rounded-xl border p-6 ${
                t.highlight
                  ? "border-primary/50 bg-primary/[0.06] shadow-2xl shadow-primary/10"
                  : "border-border/60 bg-card/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{t.name}</h3>
                {t.highlight ? (
                  <Badge>Most popular</Badge>
                ) : null}
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">{t.note}</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full"
                variant={t.highlight ? "default" : "outline"}
              >
                <Link to="/signup">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "What S3-compatible providers are supported?",
    a: "AWS S3 by default, plus Cloudflare R2, Backblaze B2, and self-hosted MinIO. Set the backend per project — no app changes needed.",
  },
  {
    q: "How is billing handled?",
    a: "Stripe powers global payments. Customers in supported African markets are auto-routed to Paystack for local cards and mobile money.",
  },
  {
    q: "Can I migrate from my existing S3 bucket?",
    a: "Yes. Point FileVault at your existing bucket prefix and we'll inventory it. New uploads use FileVault's lifecycle policies; old objects stay where they are.",
  },
  {
    q: "Do you scan files for malware?",
    a: "Optional ClamAV scanning per project, run as a worker step after upload. Adds ~2–3 seconds; toggle off for performance-critical paths.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="border-t border-border/40 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked
        </h2>
        <div className="mt-10 divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between text-base font-medium">
                {f.q}
                <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className="border-t border-border/40 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Stop building upload pipelines.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Sign up free, integrate in 5 minutes, scale when you're ready.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button size="xl" asChild>
            <Link to="/signup">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <Link to="/login" search={{ redirect: undefined }}>Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-background/60 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} FileVault. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <a href="#" className="transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Terms
          </a>
          <a href="#" className="transition-colors hover:text-foreground">
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}

function Logos() {
  const logos = ["Acme", "Loomly", "Northwind", "Stardust", "Pulse", "Foundry"];
  return (
    <section className="py-10">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground/70">
          Trusted by teams shipping production workloads
        </p>
        <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-3 sm:grid-cols-6">
          {logos.map((l) => (
            <div
              key={l}
              className="text-center font-mono text-sm text-muted-foreground/70"
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
