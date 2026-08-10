import type { AppRole } from "./roles";

export type Permission =
  | "lead:create"
  | "lead:score"
  | "lead:assign_sales"
  | "lead:assign_partner"
  | "lead:update_sales"
  | "lead:update_partner"
  | "lead:delete"
  | "users:manage"
  | "partners:manage"
  | "reports:view_all";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    "lead:create",
    "lead:score",
    "lead:assign_sales",
    "lead:assign_partner",
    "lead:update_sales",
    "lead:update_partner",
    "lead:delete",
    "users:manage",
    "partners:manage",
    "reports:view_all",
  ],
  first_call: ["lead:create", "lead:score", "lead:assign_sales"],
  sales: ["lead:update_sales", "lead:assign_partner"],
  partner: ["lead:update_partner"],
};

export function can(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
