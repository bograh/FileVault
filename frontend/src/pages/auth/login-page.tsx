import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/services";
import { useAuth } from "@/features/auth/auth-context";
import { AuthShell } from "./auth-shell";

type Stage = "credentials" | "totp";

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const search = useSearch({ strict: false }) as { redirect?: string };

  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("ada@filevault.dev");
  const [password, setPassword] = useState("hunter2-demo");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (stage === "credentials") {
        const result = await authApi.login({ email, password });
        if ("requires_2fa" in result) {
          setStage("totp");
          toast.message("Enter your 6-digit code", {
            description: "Demo: any 6 digits will work.",
          });
        } else {
          signIn(result.user);
          navigate({ to: search.redirect ?? "/dashboard" });
        }
      } else {
        const result = await authApi.login({ email, password, totp_code: code });
        if ("user" in result) {
          signIn(result.user);
          toast.success("Welcome back");
          navigate({ to: search.redirect ?? "/dashboard" });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={stage === "credentials" ? "Welcome back" : "Two-factor authentication"}
      description={
        stage === "credentials"
          ? "Sign in to your FileVault dashboard."
          : "Enter the 6-digit code from your authenticator app."
      }
      footer={
        <span className="text-muted-foreground">
          New to FileVault?{" "}
          <Link
            to="/signup"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {stage === "credentials" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="totp">Authentication code</Label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="totp"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="pl-9 font-mono tracking-[0.4em]"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              We sent a one-time code via your authenticator app. Demo: any 6
              digits.
            </p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {stage === "credentials" ? "Continue" : "Verify and sign in"}
        </Button>

        {stage === "totp" ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStage("credentials");
              setCode("");
            }}
          >
            Back to email and password
          </Button>
        ) : null}
      </form>
    </AuthShell>
  );
}
