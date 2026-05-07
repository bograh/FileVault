import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authApi } from "@/services";
import { useAuth } from "@/features/auth/auth-context";
import { AuthShell } from "./auth-shell";

const COUNTRIES: Array<{ code: string; label: string; provider: string }> = [
  { code: "US", label: "United States", provider: "Stripe" },
  { code: "GB", label: "United Kingdom", provider: "Stripe" },
  { code: "DE", label: "Germany", provider: "Stripe" },
  { code: "NG", label: "Nigeria", provider: "Paystack" },
  { code: "GH", label: "Ghana", provider: "Paystack" },
  { code: "KE", label: "Kenya", provider: "Paystack" },
  { code: "ZA", label: "South Africa", provider: "Paystack" },
  { code: "IN", label: "India", provider: "Stripe" },
];

export function SignupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider =
    COUNTRIES.find((c) => c.code === country)?.provider ?? "Stripe";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await authApi.signup({
        name,
        email,
        password,
        country,
      });
      signIn(session.user);
      toast.success("Account created — welcome to FileVault!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your FileVault account"
      description="Free Hobby tier. No credit card required."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" search={{ redirect: undefined }} className="text-foreground underline-offset-4 hover:underline">
            Sign in
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

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Asante"
            autoComplete="name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use at least 8 characters. We hash with bcrypt server-side.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Billing country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Payments will be processed via{" "}
            <span className="text-foreground">{provider}</span> — auto-selected
            from your country.
          </p>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our{" "}
          <a href="#" className="underline-offset-4 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="underline-offset-4 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </AuthShell>
  );
}
