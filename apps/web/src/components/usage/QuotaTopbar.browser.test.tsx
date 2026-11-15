import { ProviderDriverKind } from "@t3tools/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import "~/index.css";
import { applyThemePalette } from "~/themePalette";
import { QuotaTopbarView } from "./QuotaTopbar";
import {
  DEFAULT_QUOTA_PREFERENCES,
  QUOTA_PREFERENCES_KEY,
  QuotaPreferencesSchema,
  type QuotaAccount,
} from "./quotaTopbarModel";

const now = Date.parse("2026-10-24T12:00:00Z");
const accounts: readonly QuotaAccount[] = ["Codex", "Claude", "Gemini", "Cursor", "Grok"].map(
  (label, i) => ({
    id: String(i),
    label,
    driver: ProviderDriverKind.make(["codex", "claudeAgent", "antigravity", "cursor", "grok"][i]!),
    alias: "1",
    connected: true,
    failed: false,
    limits: {
      checkedAt: new Date(now).toISOString(),
      windows: [
        {
          id: "short",
          kind: "session",
          label: "5h",
          usedPercent: 28,
          windowDurationMins: 300,
          resetsAt: new Date(now + 3600000).toISOString(),
        },
        {
          id: "week",
          kind: "weekly",
          label: "Week",
          usedPercent: 38,
          resetsAt: new Date(now + 86400000).toISOString(),
        },
      ],
    },
  }),
);
const noop = () => {};
function Harness({
  refresh = noop,
  usage = noop,
  fresh = accounts,
}: {
  readonly refresh?: (automatic: boolean) => void;
  readonly usage?: () => void;
  readonly fresh?: readonly QuotaAccount[];
}) {
  const [prefs, set] = useState(DEFAULT_QUOTA_PREFERENCES);
  return (
    <div style={{ containerType: "inline-size", containerName: "quota-header", width: "100%" }}>
      <QuotaTopbarView
        accounts={fresh}
        now={now}
        preferences={prefs}
        onPreferences={set}
        onRefresh={refresh}
        onUsage={usage}
      />
    </div>
  );
}
function Persisted() {
  const [prefs, set] = useLocalStorage(
    QUOTA_PREFERENCES_KEY,
    DEFAULT_QUOTA_PREFERENCES,
    QuotaPreferencesSchema,
  );
  return (
    <QuotaTopbarView
      accounts={accounts}
      now={now}
      preferences={prefs}
      onPreferences={set}
      onRefresh={() => {}}
      onUsage={() => {}}
    />
  );
}
describe("quota topbar interactions", () => {
  it("uses one remaining label and preserves actual names for mixed windows", async () => {
    await page.viewport(1440, 900);
    await using screen = await render(<Harness />);
    await expect
      .element(screen.getByRole("button", { name: "Weekly remaining", exact: true }))
      .toBeVisible();
    expect(screen.container.querySelectorAll("[data-quota-id] [data-compact]").length).toBe(3);
    await screen.getByRole("button", { name: "View quotas" }).click();
    await page.getByRole("button", { name: "Customize", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Quota window Codex · 1" })
      .selectOptions("session:short");
    await expect
      .element(screen.getByRole("button", { name: "Remaining quota", exact: true }))
      .toBeVisible();
    expect(screen.container.querySelector('[data-quota-id="0"]')?.textContent).toContain("5h");
    expect(screen.container.querySelector('[data-quota-id="1"]')?.textContent).toContain("wk");
  });
  it("keeps unavailable distinct from zero and shows cached values with their read time", async () => {
    await page.viewport(1440, 900);
    const fresh = accounts.map((account, index) =>
      index === 0
        ? { ...account, connected: false }
        : index === 1
          ? { ...account, limits: undefined }
          : account,
    );
    await using screen = await render(<Harness fresh={fresh} />);
    const cached = screen.container.querySelector('[data-quota-id="0"]');
    expect(cached?.textContent).toContain("62%");
    expect(cached?.textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(cached?.hasAttribute("data-stale")).toBe(true);
    expect(cached?.getAttribute("aria-label")).toMatch(/Cached \d{1,2}:\d{2}.* 62%/);
    await screen.getByRole("button", { name: "View quotas" }).click();
    await page.getByRole("button", { name: "All 5 sources" }).click();
    await expect
      .element(page.getByRole("button", { name: "Claude · 1 quota details" }))
      .toMatchTextContent(/Unavailable/);
    await expect
      .element(page.getByRole("button", { name: "Claude · 1 quota details" }))
      .not.toMatchTextContent(/0%/);
  });

  it("chooses windows, orders pins, enforces four items, and retains a usable empty entry", async () => {
    await page.viewport(1440, 900);
    await using screen = await render(<Harness />);
    await screen.getByRole("button", { name: "View quotas" }).click();
    await page.getByRole("button", { name: "Customize", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Quota window Codex · 1" })
      .selectOptions("session:short");
    expect(screen.container.querySelector('[data-quota-id="0"]')?.textContent).toContain("72%");
    await page.getByRole("button", { name: "Move up Claude · 1" }).click();
    expect(
      [...screen.container.querySelectorAll("[data-quota-id]")].map((e) =>
        e.getAttribute("data-quota-id"),
      ),
    ).toEqual(["1", "0", "2"]);
    await page.getByRole("checkbox", { name: /Pin Cursor.*Account 1/ }).click();
    await page.getByRole("checkbox", { name: /Pin Grok.*Account 1/ }).click();
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Unpin an item before adding a fifth.");
    await page.getByRole("switch", { name: "Show provider names" }).click();
    expect(screen.container.querySelectorAll("[data-quota-name]").length).toBe(0);
    for (const label of ["Codex", "Claude", "Gemini", "Cursor"])
      await page.getByRole("checkbox", { name: new RegExp(`Pin ${label}.*Account 1`) }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    expect(screen.container.querySelectorAll("[data-quota-id]").length).toBe(0);
    await expect.element(screen.getByRole("button", { name: "View quotas" })).toBeVisible();
  });
  it("persists explicit hidden pins and selected windows through remount", async () => {
    localStorage.removeItem(QUOTA_PREFERENCES_KEY);
    try {
      await using screen = await render(<Persisted />);
      await screen.getByRole("button", { name: "View quotas" }).click();
      await page.getByRole("button", { name: "Customize", exact: true }).click();
      await page
        .getByRole("combobox", { name: "Quota window Codex · 1" })
        .selectOptions("session:short");
      await page.getByRole("checkbox", { name: /Pin Claude.*Account 1/ }).click();
      await screen.rerender(<div />);
      await screen.rerender(<Persisted />);
      expect(screen.container.querySelector('[data-quota-id="0"]')?.textContent).toContain("72%");
      expect(screen.container.querySelector('[data-quota-id="1"]')).toBeNull();
    } finally {
      localStorage.removeItem(QUOTA_PREFERENCES_KEY);
    }
  });
  it("handles fresh snapshot objects during twelve route-like rerenders without discarding an open panel", async () => {
    await using screen = await render(<Harness />);
    await screen.getByRole("button", { name: "View quotas" }).click();
    for (let i = 0; i < 12; i++)
      await screen.rerender(
        <Harness
          fresh={accounts.map((a) => ({
            ...a,
            limits: { ...a.limits!, windows: [...a.limits!.windows] },
          }))}
        />,
      );
    await expect.element(page.getByText("Percentages show remaining quota")).toBeVisible();
    await page.getByRole("button", { name: "All 5 sources" }).click();
    await expect
      .element(page.getByRole("button", { name: "Grok · 1 quota details" }))
      .toBeVisible();
  });
  it.each([390, 1440])(
    "fits viewport %i and exposes full usage without a generated task",
    async (width) => {
      await page.viewport(width, 900);
      const refresh = vi.fn(),
        usage = vi.fn();
      await using screen = await render(<Harness refresh={refresh} usage={usage} />);
      expect(refresh).not.toHaveBeenCalled();
      expect(screen.container.scrollWidth).toBeLessThanOrEqual(screen.container.clientWidth);
      await screen.getByRole("button", { name: "View quotas" }).click();
      expect(refresh).toHaveBeenCalledWith(true);
      const rect = document.querySelector('[data-slot="popover-popup"]')!.getBoundingClientRect();
      expect(rect.right).toBeLessThanOrEqual(width);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      await page.getByRole("button", { name: "Full usage and costs" }).click();
      expect(usage).toHaveBeenCalledOnce();
    },
  );
});

it("uses remaining quota arcs and the Apple 30 percent threshold without changing other themes", async () => {
  const fresh = accounts.slice(0, 4).map((account, index) => ({
    ...account,
    limits:
      index === 3
        ? undefined
        : {
            ...account.limits!,
            windows: account.limits!.windows.map((window) => ({
              ...window,
              usedPercent: [100, 70, 69][index]!,
            })),
          },
  }));
  const root = document.documentElement;
  const before = root.getAttribute("data-theme-id");
  const beforeStyle = root.getAttribute("style");
  await using screen = await render(
    <QuotaTopbarView
      accounts={fresh}
      now={now}
      preferences={{ ...DEFAULT_QUOTA_PREFERENCES, pins: ["0", "1", "2", "3"] }}
      onPreferences={noop}
      onRefresh={noop}
      onUsage={noop}
    />,
  );
  const rings = [
    ...screen.container.querySelectorAll<HTMLElement>("[data-quota-id] [data-compact]"),
  ];
  const baseline = rings.map((ring) => getComputedStyle(ring).backgroundImage);
  try {
    applyThemePalette("apple", "light");
    expect(rings.map((ring) => ring.style.getPropertyValue("--quota-progress"))).toEqual([
      "0%",
      "30%",
      "31%",
      "0%",
    ]);
    expect(rings.map((ring) => ring.hasAttribute("data-apple-low"))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(rings[3]!.hasAttribute("data-remaining")).toBe(false);
    expect(getComputedStyle(rings[1]!).backgroundImage).toContain("30%");
    expect(getComputedStyle(rings[2]!).backgroundImage).toContain("52, 199, 89");
  } finally {
    if (beforeStyle === null) root.removeAttribute("style");
    else root.setAttribute("style", beforeStyle);
    if (before === null) root.removeAttribute("data-theme-id");
    else root.setAttribute("data-theme-id", before);
  }
  expect(rings.map((ring) => getComputedStyle(ring).backgroundImage)).toEqual(baseline);
});
