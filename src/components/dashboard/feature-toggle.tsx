"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setTournamentFeatured } from "@/actions/admin";

/**
 * The super admin's "Feature on homepage" switch.
 *
 * Flips immediately and rolls back if the action fails, so a table of these
 * never feels like it is waiting on the network.
 */
export function FeatureToggle({
  tournamentId,
  name,
  featured,
}: {
  tournamentId: string;
  name: string;
  featured: boolean;
}) {
  const [on, setOn] = useState(featured);
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={on}
      disabled={pending}
      aria-label={`Feature ${name} on the homepage`}
      onCheckedChange={(next) => {
        setOn(next);
        startTransition(async () => {
          const res = await setTournamentFeatured(tournamentId, next);
          if (!res.ok) {
            setOn(!next);
            toast.error(res.error);
            return;
          }
          toast.success(
            next ? `${name} is on the homepage` : `${name} removed from the homepage`,
          );
        });
      }}
    />
  );
}
