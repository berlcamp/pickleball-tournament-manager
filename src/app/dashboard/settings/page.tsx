import { requireUser, getProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function SettingsPage() {
  const [user, profile] = await Promise.all([requireUser(), getProfile()]);
  const name =
    profile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your name as other organisers see it when you help run a tournament."
      />
      <ProfileForm fullName={name} email={user.email ?? ""} />
    </div>
  );
}
