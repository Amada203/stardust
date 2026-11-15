import "~/index.css";
import { expect, it } from "vite-plus/test";
import { render, act } from "../test/render";
import { useWorkbenchMode } from "./workbenchMode";
import { WorkbenchModeSettings } from "./components/settings/WorkbenchModeSettings";
import { SidebarProvider, Sidebar, SidebarTrigger } from "./components/ui/sidebar";

function Shell() {
  const { mode, setMode, resumeMode } = useWorkbenchMode();
  return (
    <SidebarProvider suspended={mode === "focus"} onResume={() => setMode(resumeMode)}>
      <Sidebar>
        <span>项目面板</span>
      </Sidebar>
      <SidebarTrigger aria-label="恢复侧栏" />
      <input aria-label="草稿" defaultValue="保留草稿" />
      <WorkbenchModeSettings />
    </SidebarProvider>
  );
}
it("switches modes without replacing the draft and restores the prior mode", async () => {
  useWorkbenchMode.setState({ mode: "full", resumeMode: "full" });
  await using screen = await render(<Shell />);
  const draft = screen.getByRole("textbox", { name: "草稿" });
  await screen.getByRole("button", { name: "专注聊天", exact: true }).click();
  expect(useWorkbenchMode.getState().mode).toBe("focus");
  await expect.element(draft).toHaveValue("保留草稿");
  await screen.getByRole("button", { name: "恢复侧栏" }).click();
  expect(useWorkbenchMode.getState().mode).toBe("full");
  await expect.element(draft).toHaveValue("保留草稿");
  await act(() => useWorkbenchMode.setState({ mode: "custom", resumeMode: "custom" }));
});

it("switches the complete experience without changing the palette or draft", async () => {
  const { useWorkbenchExperience } = await import("./workbenchExperience");
  const { setTheme, readThemePreference } = await import("./hooks/useTheme");
  useWorkbenchExperience.setState({ experience: "current" });
  setTheme("graphite");
  await using screen = await render(<Shell />);
  await screen.getByRole("button", { name: "Clawd 工作台", exact: true }).click();
  expect(useWorkbenchExperience.getState().experience).toBe("clawd");
  expect(readThemePreference()).toBe("graphite");
  await expect.element(screen.getByRole("textbox", { name: "草稿" })).toHaveValue("保留草稿");
  await screen.getByRole("button", { name: "现有工作台", exact: true }).click();
  expect(useWorkbenchExperience.getState().experience).toBe("current");
  expect(readThemePreference()).toBe("graphite");
});
