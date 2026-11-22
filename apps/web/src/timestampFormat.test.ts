import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  formatDayAwareTimestamp,
  formatUpcomingTimestamp,
  formatRelativeTimeLabel,
  formatExpiresInLabel,
} from "./timestampFormat";

describe("timestamps in an explicit time zone", () => {
  // 23:00 UTC on July 1 is 7 PM on July 1 in New York, whatever the host zone.
  const now = Date.parse("2026-07-01T23:00:00.000Z");
  const zone = "America/New_York";

  it("picks relative days from the calendar in that zone", () => {
    expect(formatUpcomingTimestamp("2026-07-02T00:30:00.000Z", "12-hour", now, zone)).not.toMatch(
      /tomorrow/,
    );
    expect(formatUpcomingTimestamp("2026-07-02T05:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^tomorrow at /,
    );
    expect(formatDayAwareTimestamp("2026-07-01T03:30:00.000Z", "12-hour", now, zone)).toMatch(
      /^yesterday at /,
    );
  });
});

import { syncCustomLocale } from "./i18n/customLocale";
afterEach(() => syncCustomLocale("en"));
it("localizes relative days, elapsed and expiry labels without changing calendar boundaries", () => {
  syncCustomLocale("zh");
  const now = Date.parse("2026-11-16T04:00:00Z");
  const zone = "America/Los_Angeles";
  expect(formatDayAwareTimestamp("2026-11-15T00:16:00Z", "24-hour", now, zone)).toBe("昨天 16:16");
  expect(formatUpcomingTimestamp("2026-11-16T16:00:00Z", "24-hour", now, zone)).toBe("明天 08:00");
  expect(formatRelativeTimeLabel(new Date(now - 52 * 60000).toISOString(), now)).toBe("52 分钟前");
  expect(formatExpiresInLabel(new Date(now + 65000).toISOString(), now)).toBe("1m 5s 后过期");
});
