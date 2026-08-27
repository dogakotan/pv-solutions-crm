import { requireActiveUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/data/users";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { SetHeaderContent } from "@/components/page-header-slot";

export default async function SettingsPage() {
  const { user } = await requireActiveUser();

  const supabase = await createClient();
  const profile = await getOwnProfile(supabase, user.id);

  if (!profile) {
    throw new Error("Profil bulunamadı.");
  }

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">Ayarlar</h1>
      </SetHeaderContent>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Profil Bilgileri</h2>
          <ProfileForm email={profile.email ?? ""} fullName={profile.fullName} phone={profile.phone ?? ""} />
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Şifre Değiştir</h2>
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
