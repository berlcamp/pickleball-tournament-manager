"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/super-admin";
import { ActionError, run } from "./helpers";

/**
 * Put a tournament on the marketing page's marquee, or take it off.
 *
 * The one mutation on the super admin screen, and the one place that does not
 * go through `assertRole`: featuring is an install-wide editorial decision, so
 * it is gated on `requireSuperAdmin()` instead and written with the
 * service-role client — the super admin is usually not a member of the
 * tournament they are featuring, and the RLS write policy would reject them.
 */
export async function setTournamentFeatured(
  tournamentId: string,
  featured: boolean,
) {
  return run(async () => {
    await requireSuperAdmin();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ActionError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("tournaments")
      .update({ featured })
      .eq("id", tournamentId);
    if (error) throw new ActionError(error.message);

    revalidatePath("/");
    revalidatePath("/dashboard/admin");
  });
}
