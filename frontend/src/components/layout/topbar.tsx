import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User as UserIcon, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Topbar({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur md:px-6">
      <div className="flex flex-1 items-center gap-3 truncate">{children}</div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://docs.filevault.io"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground"
          >
            Docs
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-sm transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback>
                  {user ? initials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">
                {user?.name ?? "Guest"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="space-y-0.5">
                <div className="text-sm font-medium normal-case tracking-normal text-foreground">
                  {user?.name}
                </div>
                <div className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                  {user?.email}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings">
                <UserIcon className="h-4 w-4" />
                Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/billing">
                <Settings className="h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await signOut();
                navigate({ to: "/login", search: { redirect: undefined } });
              }}
              className="text-destructive focus:bg-destructive/15 focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
