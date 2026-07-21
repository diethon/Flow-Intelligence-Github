import { isWeekendUTC, isNightUTC, classifyOffHours } from "../../src/utils/offHours";

describe("offHours (UTC classification)", () => {
  describe("isWeekendUTC", () => {
    it("flags Saturday and Sunday", () => {
      expect(isWeekendUTC(new Date("2026-07-18T12:00:00Z"))).toBe(true); // Sat
      expect(isWeekendUTC(new Date("2026-07-19T12:00:00Z"))).toBe(true); // Sun
    });
    it("does not flag weekdays", () => {
      expect(isWeekendUTC(new Date("2026-07-17T12:00:00Z"))).toBe(false); // Fri
      expect(isWeekendUTC(new Date("2026-07-20T12:00:00Z"))).toBe(false); // Mon
    });
  });

  describe("isNightUTC (>=20 or <6)", () => {
    it("flags late-night and early-morning hours", () => {
      expect(isNightUTC(new Date("2026-07-17T20:00:00Z"))).toBe(true); // boundary start
      expect(isNightUTC(new Date("2026-07-17T23:30:00Z"))).toBe(true);
      expect(isNightUTC(new Date("2026-07-17T05:59:00Z"))).toBe(true);
    });
    it("does not flag business hours", () => {
      expect(isNightUTC(new Date("2026-07-17T06:00:00Z"))).toBe(false); // boundary end (exclusive)
      expect(isNightUTC(new Date("2026-07-17T12:00:00Z"))).toBe(false);
      expect(isNightUTC(new Date("2026-07-17T19:59:00Z"))).toBe(false);
    });
  });

  describe("classifyOffHours", () => {
    it("weekday business hours are not off-hours", () => {
      expect(classifyOffHours(new Date("2026-07-17T12:00:00Z"))).toEqual({
        weekend: false,
        night: false,
        offHours: false,
      });
    });
    it("weekend daytime is off-hours (weekend only)", () => {
      expect(classifyOffHours(new Date("2026-07-18T12:00:00Z"))).toEqual({
        weekend: true,
        night: false,
        offHours: true,
      });
    });
    it("weekday night is off-hours (night only)", () => {
      expect(classifyOffHours(new Date("2026-07-17T23:00:00Z"))).toEqual({
        weekend: false,
        night: true,
        offHours: true,
      });
    });
    it("weekend night is both", () => {
      expect(classifyOffHours(new Date("2026-07-18T23:00:00Z"))).toEqual({
        weekend: true,
        night: true,
        offHours: true,
      });
    });
  });
});
