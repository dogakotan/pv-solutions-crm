import { requireActiveUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export default async function SettingsPage() {
  const { user } = await requireActiveUser();

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw error ?? new Error("Profil bulunamadı.");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Ayarlar</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Profil Bilgileri</h2>
          <ProfileForm email={profile.email ?? ""} fullName={profile.full_name} phone={profile.phone ?? ""} />
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-foreground">Şifre Değiştir</h2>
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
