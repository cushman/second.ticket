export type Role = "platform_admin" | "call_center" | "venue_manager" | "box_office" | "door";

export interface Membership {
  role: Role;
  /** null = platform-wide. */
  orgId: string | null;
  /** null = every venue in the org. */
  venueId: string | null;
}

export type Action =
  | "platform.manage" // create venue companies, set commissions, see everything
  | "brand.manage" // company accent color and logo
  | "venue.manage" // venues and seat maps
  | "product.manage" // shows, attractions, prices, schedules
  | "sell" // window, phone and group sales
  | "order.lookup" // find orders, will call
  | "refund"
  | "scan"
  | "report.view";

export interface Scope {
  orgId?: string | null;
  venueId?: string | null;
}

const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  platform_admin: [
    "platform.manage",
    "brand.manage",
    "venue.manage",
    "product.manage",
    "sell",
    "order.lookup",
    "refund",
    "scan",
    "report.view",
  ],
  call_center: ["sell", "order.lookup"],
  venue_manager: ["brand.manage", "venue.manage", "product.manage", "sell", "order.lookup", "refund", "scan", "report.view"],
  box_office: ["sell", "order.lookup", "scan"],
  door: ["scan"],
};

// Company-wide actions a venue-restricted membership can't take.
const ORG_LEVEL: readonly Action[] = ["brand.manage", "platform.manage"];

function covers(m: Membership, action: Action, scope: Scope): boolean {
  if (!ROLE_ACTIONS[m.role].includes(action)) return false;
  if (m.orgId === null) return true;
  if (action === "platform.manage") return false;
  if (!scope.orgId || scope.orgId !== m.orgId) return false;
  if (m.venueId === null) return true;
  if (ORG_LEVEL.includes(action)) return false;
  return scope.venueId === m.venueId;
}

export function can(memberships: readonly Membership[], action: Action, scope: Scope = {}): boolean {
  return memberships.some((m) => covers(m, action, scope));
}

/** Org ids where the user can take an action; "all" for platform-wide roles. */
export function orgsFor(memberships: readonly Membership[], action: Action): "all" | string[] {
  const ids = new Set<string>();
  for (const m of memberships) {
    if (!ROLE_ACTIONS[m.role].includes(action)) continue;
    if (m.orgId === null) return "all";
    if (ORG_LEVEL.includes(action) && m.venueId !== null) continue;
    ids.add(m.orgId);
  }
  return [...ids];
}

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform admin",
  call_center: "Call center",
  venue_manager: "Venue manager",
  box_office: "Box office",
  door: "Door staff",
};
