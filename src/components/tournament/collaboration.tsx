"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  inviteMember,
  removeMember,
  updateMemberRole,
  cancelInvite,
} from "@/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_LABELS, roleAtLeast } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import type { Role } from "@/types";

export interface MemberRow {
  id: string;
  user_id: string;
  role: Role;
  name: string;
  email: string;
  avatar_url: string | null;
}
export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  status: string;
}

const ROLE_HINTS: Record<Exclude<Role, "owner">, string> = {
  admin: "Can change teams, groups, schedule and settings.",
  scorekeeper: "Can enter scores only.",
  viewer: "Can look, but not change anything.",
};

type MemberOp =
  | { type: "role"; id: string; role: Role }
  | { type: "remove"; id: string };

export function Collaboration({
  tournamentId,
  myRole,
  members,
  invites,
}: {
  tournamentId: string;
  myRole: Role;
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [inviting, startInvite] = useTransition();
  const [, startRowAction] = useTransition();
  // Which row's control is mid-save, so only that control shows a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<MemberRow | null>(null);
  const canManage = roleAtLeast(myRole, "admin");
  const isOwner = myRole === "owner";

  // The list changes the moment the owner acts; the revalidated props replace
  // it when the action returns, and a failure simply falls back to them.
  const [shownMembers, applyMember] = useOptimistic(
    members,
    (list: MemberRow[], op: MemberOp) =>
      op.type === "remove"
        ? list.filter((m) => m.id !== op.id)
        : list.map((m) => (m.id === op.id ? { ...m, role: op.role } : m)),
  );
  const [shownInvites, dropInvite] = useOptimistic(
    invites,
    (list: InviteRow[], id: string) => list.filter((i) => i.id !== id),
  );

  const emailLooksValid = /^\S+@\S+\.\S+$/.test(email.trim());

  function invite() {
    startInvite(async () => {
      const res = await inviteMember(tournamentId, { email, role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail("");
    });
  }

  function changeRole(m: MemberRow, next: Role) {
    setBusyId(m.id);
    startRowAction(async () => {
      applyMember({ type: "role", id: m.id, role: next });
      const res = await updateMemberRole(tournamentId, m.id, next);
      setBusyId(null);
      if (!res.ok) toast.error(`Couldn't change the role: ${res.error}`);
    });
  }

  function remove(m: MemberRow) {
    setToRemove(null);
    startRowAction(async () => {
      applyMember({ type: "remove", id: m.id });
      const res = await removeMember(tournamentId, m.id);
      if (!res.ok) toast.error(`Couldn't remove ${m.name || m.email}: ${res.error}`);
    });
  }

  function cancel(i: InviteRow) {
    startRowAction(async () => {
      dropInvite(i.id);
      const res = await cancelInvite(tournamentId, i.id);
      if (!res.ok) toast.error(`Couldn't cancel the invite: ${res.error}`);
    });
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-xl font-bold">Helpers</h2>
          <p className="text-sm text-muted-foreground">
            Invite other people&apos;s Google accounts to help run this
            tournament.
          </p>
        </div>
      </div>

      {canManage && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (emailLooksValid && !inviting) invite();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Gmail address</Label>
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="teammate@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={email.length > 3 && !emailLooksValid}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="scorekeeper">Scorekeeper</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !emailLooksValid}>
              {inviting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {inviting ? "Sending…" : "Invite"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {email.length > 3 && !emailLooksValid ? (
              <span className="text-destructive">
                That doesn&apos;t look like an email address yet.
              </span>
            ) : (
              ROLE_HINTS[role as Exclude<Role, "owner">]
            )}
          </p>
        </form>
      )}

      <div className="space-y-2">
        <p className="eyebrow">People with access ({shownMembers.length})</p>
        {shownMembers.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-muted/50 px-3 py-2"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="size-9">
                {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                <AvatarFallback>{initials(m.name || m.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {m.name || m.email}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {m.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isOwner && m.role !== "owner" ? (
                <div className="relative">
                  <RoleSelect
                    value={m.role}
                    onChange={(r) => changeRole(m, r)}
                  />
                  {busyId === m.id && (
                    <Loader2
                      className="absolute -left-5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                      aria-label="Saving"
                    />
                  )}
                </div>
              ) : (
                <Badge
                  className={
                    m.role === "owner"
                      ? "border-0 bg-court text-court-foreground"
                      : "border-0 bg-secondary text-secondary-foreground"
                  }
                >
                  {ROLE_LABELS[m.role]}
                </Badge>
              )}
              {isOwner && m.role !== "owner" && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${m.name || m.email}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setToRemove(m)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {shownInvites.length > 0 && (
          <p className="eyebrow pt-3">
            Waiting to accept ({shownInvites.length})
          </p>
        )}
        {shownInvites.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                <Mail className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm">{i.email}</div>
                <div className="text-xs text-muted-foreground">
                  Invited as {ROLE_LABELS[i.role]} · joins on first sign-in
                </div>
              </div>
            </div>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Cancel invite for ${i.email}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => cancel(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {toRemove?.name || toRemove?.email}?
            </DialogTitle>
            <DialogDescription>
              They lose access to this tournament straight away. You can invite
              them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRemove(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => toRemove && remove(toRemove)}
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger className="w-36" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="scorekeeper">Scorekeeper</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}
