import { expect, it } from "vite-plus/test";
import { applyThemeCss } from "./themeCss";
import {
  parseThemeFile,
  serializeThemeFile,
  installCustomTheme,
  getCustomThemes,
  invalidateCustomThemes,
  removeCustomTheme,
} from "./themePalette";
import clawd from "./t3-clawd.json";
it("preserves imported CSS through storage and export", () => {
  const theme = parseThemeFile({
    ...clawd,
    name: "Clawd compatibility test",
    id: "clawd-compat-test",
  });
  try {
    expect(theme.css).toBe(clawd.css);
    installCustomTheme(theme);
    invalidateCustomThemes();
    const restored = getCustomThemes().find((item) => item.id === theme.id)!;
    expect(JSON.parse(serializeThemeFile(restored)).css).toBe(clawd.css);
    expect(() => parseThemeFile({ ...clawd, css: "a".repeat(50001) })).toThrow();
  } finally {
    removeCustomTheme(theme.id);
  }
});
it("removes outgoing CSS and strips remote resource requests", () => {
  const probe = document.createElement("div");
  probe.id = "theme-css-test";
  document.body.append(probe);
  try {
    applyThemeCss(
      "#theme-css-test { color: rgb(1, 2, 3); background-image: url(https://example.invalid/private); }",
    );
    expect(getComputedStyle(probe).color).toBe("rgb(1, 2, 3)");
    expect(getComputedStyle(probe).backgroundImage).toBe("none");
    applyThemeCss(undefined);
    expect(getComputedStyle(probe).color).not.toBe("rgb(1, 2, 3)");
    applyThemeCss(clawd.css);
    applyThemeCss(undefined);
  } finally {
    applyThemeCss(undefined);
    probe.remove();
  }
});

it("keeps experience layout independent of palette CSS and removes it on return", async () => {
  const { syncWorkbenchExperience } = await import("./workbenchExperience");
  const host = document.createElement("div");
  host.innerHTML =
    '<div class="shrink-0"><button data-workbench-action="new-thread" aria-label="新建会话" data-workbench-shortcut="Ctrl+N">+</button></div>';
  document.body.append(host);
  const button = host.querySelector("button")!;
  try {
    applyThemeCss("body { --qa-palette: retained }");
    syncWorkbenchExperience("clawd");
    expect(getComputedStyle(host).flexDirection).toBe("column");
    expect(getComputedStyle(button, "::after").content).toBe('"新建会话"');
    expect(getComputedStyle(button, "::before").content).toBe('"Ctrl+N"');
    expect(getComputedStyle(document.body).getPropertyValue("--qa-palette").trim()).toBe(
      "retained",
    );
    syncWorkbenchExperience("current");
    expect(getComputedStyle(button, "::after").content).toBe("none");
    expect(getComputedStyle(document.body).getPropertyValue("--qa-palette").trim()).toBe(
      "retained",
    );
  } finally {
    syncWorkbenchExperience("current");
    applyThemeCss(undefined);
    host.remove();
  }
});
