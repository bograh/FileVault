import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/features/auth/auth-context";

export function AccountSettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [twoFactor, setTwoFactor] = useState(
    user?.two_factor_enabled ?? false,
  );
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function onSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("Profile updated", {
      description: "Mock backend — changes are local for now.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="You"
        title="Account"
        description="Update your profile, security, and notification preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How we display your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save profile
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Two-factor authentication uses TOTP — Google Authenticator, 1Password,
            or any compatible app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">
                  Two-factor authentication
                </div>
                <div className="text-xs text-muted-foreground">
                  Required for all admin actions on Pro and above.
                </div>
              </div>
            </div>
            <Switch
              checked={twoFactor}
              onCheckedChange={(v) => {
                setTwoFactor(v);
                toast.success(v ? "2FA enabled" : "2FA disabled");
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Button variant="outline">Change password</Button>
            <p className="text-xs text-muted-foreground">
              You'll be sent a confirmation email before the change takes
              effect.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>What we email you about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NotificationRow
            label="Quota warnings"
            hint="When usage hits 80% or 100% of your tier limit."
            defaultChecked
          />
          <NotificationRow
            label="Webhook delivery failures"
            hint="When a webhook endpoint returns 3+ consecutive errors."
            defaultChecked
          />
          <NotificationRow
            label="Billing events"
            hint="Payment success/failure, subscription changes."
            defaultChecked
          />
          <NotificationRow
            label="Product updates"
            hint="Monthly digest of new features and changelog."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  label,
  hint,
  defaultChecked,
}: {
  label: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  const [v, setV] = useState(!!defaultChecked);
  return (
    <div className="flex items-start justify-between rounded-md border border-border/60 bg-card/40 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={v} onCheckedChange={setV} />
    </div>
  );
}
