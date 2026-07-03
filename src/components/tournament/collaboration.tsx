"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  inviteMember,
  removeMember,
  updateMemberRole,
  cancelInvite,
} from "@/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_LABELS, roleAtLeast } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Mail, Trash2, UserPlus } from "lucide-react";
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
  const [pending, startTransition] = useTransition();
  const canManage = roleAtLeast(myRole, "admin");
  const isOwner = myRole === "owner";

  function invite() {
    startTransition(async () => {
      const res = await inviteMember(tournamentId, { email, role });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Invitation sent");
      setEmail("");
    });
  }

  return (
    <div className="glass space-y-5 rounded-2xl p-5">
      <div>
        <h3 className="font-semibold">Collaboration</h3>
        <p className="text-sm text-muted-foreground">
          Invite Google accounts to help run this tournament.
        </p>
      </div>

      {canManage && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="teammate@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="scorekeeper">Scorekeeper</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={pending || !email}>
            <UserPlus className="size-4" /> Invite
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          People with access ({members.length})
        </p>
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-card/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8">
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
            <div className="flex items-center gap-2">
              {isOwner && m.role !== "owner" ? (
                <RoleSelect
                  value={m.role}
                  onChange={(r) =>
                    startTransition(async () => {
                      const res = await updateMemberRole(tournamentId, m.id, r);
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Role updated");
                    })
                  }
                />
              ) : (
                <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
              )}
              {isOwner && m.role !== "owner" && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await removeMember(tournamentId, m.id);
                      if (!res.ok) toast.error(res.error);
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {invites.length > 0 && (
          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending invitations ({invites.length})
          </p>
        )}
        {invites.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-muted">
                <Mail className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm">{i.email}</div>
                <div className="text-xs text-muted-foreground">
                  Pending · {ROLE_LABELS[i.role]}
                </div>
              </div>
            </div>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  startTransition(async () => {
                    const res = await cancelInvite(tournamentId, i.id);
                    if (!res.ok) toast.error(res.error);
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
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
      <SelectTrigger className="h-8 w-36">
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
