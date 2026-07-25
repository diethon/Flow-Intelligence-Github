import { describe, expect, it } from "vitest";
import {
  canManagePrivacySettings,
  canManageWeeklyBrief,
  canViewPublishedWeeklyBrief,
} from "./modulePermissions";

describe("weekly brief permissions", () => {
  it.each([
    ["admin", "viewer", true],
    ["user", "leader", true],
    ["user", "dev", false],
    ["user", "viewer", false],
  ] as const)("manage: %s / %s => %s", (globalRole, repositoryRole, expected) => {
    expect(canManageWeeklyBrief({ globalRole, repositoryRole })).toBe(expected);
  });

  it.each([
    ["admin", "viewer", true, true],
    ["user", "leader", true, true],
    ["user", "dev", true, true],
    ["user", "viewer", true, false],
    ["user", "viewer", false, true],
  ] as const)(
    "published read: %s / %s / private=%s => %s",
    (globalRole, repositoryRole, isPrivate, expected) => {
      expect(
        canViewPublishedWeeklyBrief({ globalRole, repositoryRole, isPrivate })
      ).toBe(expected);
    }
  );
});

describe("privacy permissions", () => {
  it.each([
    ["admin", "viewer", true],
    ["user", "leader", true],
    ["user", "dev", false],
    ["user", "viewer", false],
  ] as const)("%s / %s => %s", (globalRole, repositoryRole, expected) => {
    expect(canManagePrivacySettings({ globalRole, repositoryRole })).toBe(expected);
  });
});

