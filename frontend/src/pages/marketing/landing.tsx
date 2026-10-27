import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  CloudUpload,
  Code2,
  DatabaseZap,
  FileArchive,
  Fingerprint,
  GitBranch,
  Globe2,
  KeyRound,
  LockKeyhole,
  Radio,
  ScanSearch,
  ServerCog,
  ShieldCheck,
  Terminal,
  UploadCloud,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "https://docs.filevault.io" },
];

const PARTNERS = ["Vercel", "Railway", "Fly.io", "Supabase", "Linear"];

const WORKFLOWS = [
  {
    icon: CloudUpload,
    title: "Direct uploads",
    body: "Issue short-lived upload URLs and send large files straight to S3, R2, B2, or MinIO without proxying bytes through your app.",
  },
  {
    icon: Webhook,
    title: "Event delivery",
    body: "Subscribe to upload.completed, scan.failed, quota.warning, and deletion events with signed retries and searchable delivery logs.",
  },
  {
    icon: ShieldCheck,
    title: "Policy controls",
    body: "Enforce MIME inspection, project quotas, lifecycle rules, CORS, IP allowlists, and optional malware scanning per environment.",
  },
];

const SECURITY = [
  {
    icon: Fingerprint,
    title: "Scoped API keys",
    body: "Create project tokens with read, write, delete, and admin permissions. Rotate keys without changing bucket credentials.",
  },
  {
    icon: ScanSearch,
    title: "Content inspection",
    body: "Validate file signatures before objects become available. Quarantine suspicious uploads and notify your app immediately.",
  },
  {
    icon: LockKeyhole,
    title: "Tenant isolation",
    body: "Separate prefixes, quotas, lifecycle policies, CORS rules, and audit trails for every product, team, or customer.",
  },
  {
    icon: Globe2,
    title: "Region aware",
    body: "Pin projects to the region and storage provider that matches your latency, residency, and compliance requirements.",
  },
];

const SDK_FEATURES = [
  "Browser and server SDKs",
  "Multipart and resumable uploads",
  "Typed errors and retry helpers",
  "OpenAPI for custom clients",
  "Webhook signature verification",
  "BYO bucket configuration",
  "Usage analytics and quotas",
  "Audit log export",
  "Custom domains",
];

const TIERS = [
  {
    name: "Hobby",
    price: "$0",
    note: "for side projects",
    features: ["1 project", "5 GB storage", "10 GB transfer"],
  },
  {
    name: "Launch",
    price: "$19",
    note: "per month",
    features: ["5 projects", "50 GB storage", "Webhooks and scanning"],
    featured: true,
  },
  {
    name: "Scale",
    price: "$79",
    note: "per month",
    features: ["25 projects", "500 GB storage", "Custom domains"],
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#020303] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(105,180,160,0.16),transparent_24%),radial-gradient(circle_at_18%_44%,rgba(135,135,135,0.13),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.14] [background-image:linear-gradient(to_right,rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_top,black_0%,transparent_70%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.7)_60%,#020303)]" />
      <MarketingNav />
      <main className="relative z-10">
        <Hero />
        <PartnerStrip />
        <LanguageSection />
        <OpenSourceSection />
        <ProductSection />
        <SecuritySection />
        <SdkSection />
        <PricingSection />
        <FooterCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] shadow-[0_0_28px_rgba(255,255,255,0.12)]">
            <FileArchive className="h-4 w-4 text-zinc-100" />
          </span>
          <span className="text-sm font-semibold tracking-tight">FileVault</span>
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] md:flex">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-zinc-500 transition-colors hover:text-zinc-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-zinc-300 hover:bg-white/10 hover:text-white sm:inline-flex"
            asChild
          >
            <Link to="/login" search={{ redirect: undefined }}>
              Sign in
            </Link>
          </Button>
          <Button
            size="sm"
            className="bg-zinc-100 text-zinc-950 hover:bg-white"
            asChild
          >
            <Link to="/signup">Start</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative px-4 pb-24 pt-32 text-center sm:px-6 md:pb-32 md:pt-40">
      <CircuitDetails />
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400 shadow-[0_0_40px_rgba(255,255,255,0.06)]">
          <Radio className="h-3.5 w-3.5 text-emerald-300" />
          Upload infrastructure for production apps
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl">
          The file platform for modern APIs
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-sm leading-6 text-zinc-400 sm:text-base">
          FileVault gives developers secure uploads, signed delivery URLs,
          scanning, quotas, webhooks, and audit trails without rebuilding the
          storage pipeline for every product.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="bg-zinc-100 text-zinc-950 hover:bg-white"
            asChild
          >
            <Link to="/signup">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="text-zinc-300 hover:bg-white/10 hover:text-white"
            asChild
          >
            <a href="https://docs.filevault.io">
              Documentation <ChevronRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-5xl">
        <HeroConsole />
      </div>
    </section>
  );
}

function CircuitDetails() {
  return (
    <>
      <div className="absolute left-8 top-28 hidden h-24 w-40 border-l border-t border-white/10 md:block" />
      <div className="absolute right-10 top-36 hidden h-32 w-52 border-r border-t border-emerald-200/10 md:block" />
      <div className="absolute left-[12%] top-40 hidden h-1.5 w-1.5 rounded-full bg-emerald-300/70 shadow-[0_0_18px_rgba(110,231,183,0.8)] lg:block" />
      <div className="absolute right-[22%] top-24 hidden h-1.5 w-1.5 rounded-full bg-zinc-200/60 shadow-[0_0_16px_rgba(255,255,255,0.6)] lg:block" />
    </>
  );
}

function HeroConsole() {
  return (
    <div className="rounded-lg border border-white/10 bg-black/60 p-1 text-left shadow-[0_0_90px_rgba(255,255,255,0.13)] backdrop-blur">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.07] px-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Terminal className="h-3.5 w-3.5" />
          uploads.ts
        </div>
      </div>
      <div className="grid min-h-[330px] grid-cols-1 lg:grid-cols-[0.95fr_1.25fr]">
        <div className="border-b border-white/[0.07] p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Pipeline</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] text-emerald-200">
              live
            </span>
          </div>
          <div className="space-y-3">
            {[
              ["POST", "/v1/uploads", "201", "42 ms"],
              ["SCAN", "invoice-q4.pdf", "clean", "1.8 s"],
              ["HOOK", "upload.completed", "200", "74 ms"],
              ["GET", "/signed-url", "200", "18 ms"],
            ].map(([method, path, status, time]) => (
              <div
                key={`${method}-${path}`}
                className="grid grid-cols-[48px_1fr_42px_48px] items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 font-mono text-[11px]"
              >
                <span className="text-zinc-500">{method}</span>
                <span className="truncate text-zinc-300">{path}</span>
                <span className="text-emerald-300">{status}</span>
                <span className="text-right text-zinc-500">{time}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-white/[0.06] bg-zinc-950/70 p-3">
            <div className="mb-3 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Storage used</span>
              <span>128.4 GB / 500 GB</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[26%] rounded-full bg-emerald-300" />
            </div>
          </div>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6 text-zinc-300 sm:p-6">
          <code>{`import { FileVault } from "@filevault/sdk";

const vault = new FileVault({
  apiKey: process.env.FILEVAULT_KEY,
});

const upload = await vault.uploads.create({
  project: "prod_media",
  filename: file.name,
  contentType: file.type,
  scan: true,
});

await upload.put(file);

return vault.urls.sign(upload.id, {
  expiresIn: "15m",
});`}</code>
        </pre>
      </div>
    </div>
  );
}

function PartnerStrip() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-xs text-zinc-600">Runs with the stack you already use</p>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {PARTNERS.map((partner) => (
            <div
              key={partner}
              className="text-center font-mono text-sm text-zinc-500"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LanguageSection() {
  return (
    <section id="product" className="px-4 py-24 sm:px-6">
      <SectionHeader
        eyebrow="Any language, any framework"
        title="Add secure uploads with one API surface"
        body="Simple SDKs and REST endpoints cover the lifecycle from request validation to delivery URLs, webhooks, scans, and retention."
      />
      <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-white/10 bg-white/[0.025] p-1 shadow-[0_0_80px_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2 text-xs text-zinc-500">
          <Code2 className="h-3.5 w-3.5" />
          TypeScript
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
          <div className="border-b border-white/[0.07] p-4 md:border-b-0 md:border-r">
            {["Create upload", "Scan object", "Deliver webhook", "Issue URL"].map(
              (item, index) => (
                <div
                  key={item}
                  className={`rounded-md px-3 py-2 text-sm ${
                    index === 0
                      ? "bg-white/10 text-white"
                      : "text-zinc-500"
                  }`}
                >
                  {item}
                </div>
              ),
            )}
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6 text-zinc-300">
            <code>{`const upload = await filevault.uploads.prepare({
  projectId: "prj_9f83",
  path: "customers/acme/contract.pdf",
  maxBytes: 50_000_000,
  allowedTypes: ["application/pdf"],
});

await filevault.webhooks.verify(request);

const url = await filevault.files.sign(upload.fileId);`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function OpenSourceSection() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Open-source core, hosted when you need it
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">
            Keep upload logic inspectable. Run the API beside your app, or use
            FileVault Cloud when you want managed workers, logs, and billing.
          </p>
          <Button
            className="mt-7 bg-zinc-100 text-zinc-950 hover:bg-white"
            size="sm"
            asChild
          >
            <a href="https://github.com">
              Star on GitHub <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <div className="relative min-h-[280px] rounded-lg border border-white/10 bg-white/[0.025] shadow-[0_0_90px_rgba(255,255,255,0.1)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(255,255,255,0.16),transparent_36%)]" />
          <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border border-white/10 bg-black shadow-[0_0_60px_rgba(255,255,255,0.18)]">
            <GitBranch className="h-12 w-12 text-zinc-300" />
          </div>
          <div className="absolute left-10 top-12 h-px w-28 bg-gradient-to-r from-transparent to-emerald-300/30" />
          <div className="absolute bottom-14 right-12 h-px w-36 bg-gradient-to-r from-emerald-300/30 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <SectionHeader
        eyebrow="Everything for your upload API"
        title="Build, monitor, analyze, and protect file flows"
        body="The dashboard gives engineers a clear operational view of storage, transfer, scans, webhook delivery, and project health."
      />
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <DashboardPanel />
        <div className="grid gap-4">
          {WORKFLOWS.map((item) => (
            <FeaturePanel key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPanel() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4 shadow-[0_0_80px_rgba(255,255,255,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
            <Activity className="h-4 w-4 text-emerald-300" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Production media</p>
            <p className="text-xs text-zinc-500">Last 24 hours</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200">
          healthy
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Uploads", "18.2k"],
          ["Transfer", "412 GB"],
          ["Scan pass", "99.98%"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/[0.07] bg-black/30 p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-40 items-end gap-1.5 rounded-md border border-white/[0.07] bg-black/30 p-3">
        {[28, 44, 34, 58, 46, 72, 66, 80, 52, 74, 92, 68, 84, 62, 78, 88].map(
          (height, index) => (
            <span
              key={`${height}-${index}`}
              className="flex-1 rounded-sm bg-gradient-to-t from-emerald-400/30 to-zinc-100/75"
              style={{ height: `${height}%` }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function FeaturePanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CloudUpload;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
      <Icon className="h-5 w-5 text-emerald-300" />
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p>
    </div>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="px-4 py-24 sm:px-6">
      <SectionHeader
        eyebrow="Secure and scalable from day one"
        title="Storage controls that keep up with your product"
        body="Start with direct uploads, then add isolation, inspection, logs, and regional policy without changing your application flow."
      />
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2">
        {SECURITY.map((item) => (
          <FeaturePanel key={item.title} {...item} />
        ))}
      </div>
    </section>
  );
}

function SdkSection() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm text-zinc-500">Leveled-up API development</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            The upload layer your team stops rewriting
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SDK_FEATURES.map((feature, index) => {
            const icons = [
              Code2,
              UploadCloud,
              ServerCog,
              DatabaseZap,
              KeyRound,
              Boxes,
              Activity,
              ShieldCheck,
              Globe2,
            ];
            const Icon = icons[index];
            return (
              <div key={feature} className="flex gap-3 rounded-md p-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-zinc-300" />
                </span>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">{feature}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    A focused primitive for production file infrastructure.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="px-4 py-24 sm:px-6">
      <SectionHeader
        eyebrow="Pricing"
        title="Start small, keep the same primitives at scale"
        body="Free for prototypes, predictable for production, and available as managed cloud or self-hosted infrastructure."
      />
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-lg border p-5 ${
              tier.featured
                ? "border-zinc-300/30 bg-white/[0.08] shadow-[0_0_70px_rgba(255,255,255,0.12)]"
                : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <h3 className="text-base font-semibold text-white">{tier.name}</h3>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight text-white">
                {tier.price}
              </span>
              <span className="pb-1 text-sm text-zinc-500">{tier.note}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-emerald-300" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-7 w-full ${
                tier.featured
                  ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                  : "border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white"
              }`}
              variant={tier.featured ? "default" : "outline"}
              asChild
            >
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className="px-4 py-28 text-center sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-6xl">
          Protect your files. Start today.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-zinc-500">
          Create an API key, connect a bucket, and ship upload flows your team
          can observe and control.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button className="bg-zinc-100 text-zinc-950 hover:bg-white" asChild>
            <Link to="/signup">Start free</Link>
          </Button>
          <Button
            variant="ghost"
            className="text-zinc-300 hover:bg-white/10 hover:text-white"
            asChild
          >
            <a href="https://docs.filevault.io">Read docs</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-zinc-600">No credit card required.</p>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.07] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2 text-white">
              <FileArchive className="h-5 w-5" />
              <span className="font-semibold">FileVault</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-zinc-600">
              Upload, storage, delivery, and security infrastructure for
              developer teams.
            </p>
          </div>
          {[
            ["Product", "Features", "Pricing", "Changelog"],
            ["Resources", "Docs", "Templates", "Status"],
            ["Company", "About", "Contact", "Careers"],
            ["Legal", "Privacy", "Terms", "Security"],
          ].map(([heading, ...items]) => (
            <div key={heading}>
              <h3 className="text-sm font-medium text-zinc-300">{heading}</h3>
              <ul className="mt-4 space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-zinc-600 hover:text-zinc-300">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 text-[clamp(4.5rem,16vw,13rem)] font-semibold leading-none tracking-tight text-white/[0.06]">
          FileVault
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm text-zinc-500">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-6 text-zinc-500">
        {body}
      </p>
    </div>
  );
}
