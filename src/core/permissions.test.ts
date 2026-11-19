import { describe, expect, it } from "vitest";
import { can, orgsFor, type Membership } from "./permissions";

const ORG = "org-main-hall";
const OTHER = "org-raceway";
const VENUE = "venue-main-hall";

const admin: Membership = { role: "platform_admin", orgId: null, venueId: null };
const callCenter: Membership = { role: "call_center", orgId: null, venueId: null };
const manager: Membership = { role: "venue_manager", orgId: ORG, venueId: null };
const venueOnlyManager: Membership = { role: "venue_manager", orgId: ORG, venueId: VENUE };
const boxOffice: Membership = { role: "box_office", orgId: ORG, venueId: VENUE };
const door: Membership = { role: "door", orgId: ORG, venueId: VENUE };

describe("can", () => {
  it("lets platform admins do everything everywhere", () => {
    expect(can([admin], "platform.manage")).toBe(true);
    expect(can([admin], "refund", { orgId: OTHER })).toBe(true);
  });

  it("lets the call center sell for every venue but not manage or refund", () => {
    expect(can([callCenter], "sell", { orgId: ORG, venueId: VENUE })).toBe(true);
    expect(can([callCenter], "sell", { orgId: OTHER })).toBe(true);
    expect(can([callCenter], "refund", { orgId: ORG })).toBe(false);
    expect(can([callCenter], "product.manage", { orgId: ORG })).toBe(false);
  });

  it("keeps venue managers inside their own company", () => {
    expect(can([manager], "product.manage", { orgId: ORG, venueId: VENUE })).toBe(true);
    expect(can([manager], "brand.manage", { orgId: ORG })).toBe(true);
    expect(can([manager], "product.manage", { orgId: OTHER })).toBe(false);
    expect(can([manager], "platform.manage")).toBe(false);
  });

  it("limits venue-restricted staff to their venue and blocks company settings", () => {
    expect(can([venueOnlyManager], "product.manage", { orgId: ORG, venueId: VENUE })).toBe(true);
    expect(can([venueOnlyManager], "product.manage", { orgId: ORG, venueId: "venue-annex" })).toBe(false);
    expect(can([venueOnlyManager], "brand.manage", { orgId: ORG })).toBe(false);
  });

  it("gives box office and door staff only their jobs", () => {
    expect(can([boxOffice], "sell", { orgId: ORG, venueId: VENUE })).toBe(true);
    expect(can([boxOffice], "refund", { orgId: ORG, venueId: VENUE })).toBe(false);
    expect(can([door], "scan", { orgId: ORG, venueId: VENUE })).toBe(true);
    expect(can([door], "sell", { orgId: ORG, venueId: VENUE })).toBe(false);
  });

  it("denies when there are no memberships", () => {
    expect(can([], "scan", { orgId: ORG })).toBe(false);
  });
});

describe("orgsFor", () => {
  it("returns all for platform roles and own orgs otherwise", () => {
    expect(orgsFor([admin], "product.manage")).toBe("all");
    expect(orgsFor([manager, { role: "venue_manager", orgId: OTHER, venueId: null }], "product.manage")).toEqual([ORG, OTHER]);
    expect(orgsFor([venueOnlyManager], "brand.manage")).toEqual([]);
    expect(orgsFor([door], "product.manage")).toEqual([]);
  });
});
