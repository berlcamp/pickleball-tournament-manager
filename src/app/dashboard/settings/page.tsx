import { requireUser, getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const name =
    profile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile and account."
      />
      <ProfileForm fullName={name} email={user.email ?? ""} />
    </div>
  );
}
