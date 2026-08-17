import {
  LayoutDashboard,
  Users,
  Briefcase,
  Handshake,
  FileText,
  ListChecks,
  Bell,
  BarChart3,
  Settings,
  Send,
  Kanban,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/auth/roles";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ["admin", "first_call", "sales", "partner"];

export const menuItems: MenuItem[] = [
  { label: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  // Admin bu üçünü tek, sekmeli sayfada (/leads) görür — bkz. src/app/(protected)/leads.
  // first_call/sales/partner kendi rolüne özel sayfasını (RLS zaten kendi verisiyle sınırlıyor) kullanmaya devam eder.
  { label: "Leadler", href: "/leads", icon: Users, roles: ["admin"] },
  { label: "Atamalar", href: "/admin/assignments", icon: Send, roles: ["admin"] },
  { label: "Lead Havuzu", href: "/first-call/lead-pool", icon: Users, roles: ["first_call"] },
  { label: "Satışa Atama", href: "/first-call/assignments", icon: Send, roles: ["first_call"] },
  { label: "Leadlerim", href: "/sales/my-leads", icon: Briefcase, roles: ["sales"] },
  { label: "Satış Hunisi", href: "/sales/pipeline", icon: Kanban, roles: ["sales"] },
  { label: "Bana Yönlendirilenler", href: "/partner/assigned-leads", icon: Handshake, roles: ["partner"] },
  { label: "Saha Ziyaretleri", href: "/partner/site-visits", icon: MapPin, roles: ["partner"] },
  { label: "Partnerler", href: "/partners", icon: Handshake, roles: ["admin", "sales"] },
  { label: "Kullanıcılar", href: "/admin/users", icon: Users, roles: ["admin"] },
  { label: "Teklifler", href: "/offers", icon: FileText, roles: ALL_ROLES },
  { label: "Aktiviteler", href: "/activities", icon: ListChecks, roles: ALL_ROLES },
  { label: "Bildirimler", href: "/notifications", icon: Bell, roles: ALL_ROLES },
  { label: "Raporlar", href: "/reports", icon: BarChart3, roles: ALL_ROLES },
  { label: "Ayarlar", href: "/settings", icon: Settings, roles: ALL_ROLES },
];
