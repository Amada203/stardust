import { useWorkbenchExperience } from "../../workbenchExperience";
import { useState } from "react";
import { useWorkbenchMode } from "../../workbenchMode";
import {
  installCustomTheme,
  parseThemeFile,
  getCustomThemes,
  updateCustomTheme,
} from "../../themePalette";
import { setTheme } from "../../hooks/useTheme";
import clawd from "../../t3-clawd.json";
import { Button } from "../ui/button";

export function WorkbenchModeSettings() {
  const { experience, setExperience } = useWorkbenchExperience();
  const { mode, setMode } = useWorkbenchMode();
  const [error, setError] = useState<string | null>(null);
  function applyClawd() {
    try {
      const theme = parseThemeFile({
        ...clawd,
        id: "t3-clawd-colors",
        name: "Clawd 配色",
        css: undefined,
      });
      if (getCustomThemes().some((item) => item.id === theme.id)) updateCustomTheme(theme);
      else installCustomTheme(theme);
      if (!setTheme(theme.id)) throw new Error("主题未能保存，请重试。");

      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切换失败，请重试。");
    }
  }
  return (
    <section className="space-y-3 px-3 sm:px-4" aria-label="工作台模式">
      <h3 className="text-base font-semibold">工作台体验</h3>
      <p className="text-sm text-muted-foreground">
        整体切换布局、导航、模型选择器与交互；保留当前配色。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={experience === "current" ? "default" : "outline"}
          aria-pressed={experience === "current"}
          onClick={() => {
            setExperience("current");
            setMode("custom");
          }}
        >
          现有工作台
        </Button>
        <Button
          variant={experience === "clawd" ? "default" : "outline"}
          aria-pressed={experience === "clawd"}
          onClick={() => {
            setExperience("clawd");
            setMode("custom");
          }}
        >
          Clawd 工作台
        </Button>
      </div>
      <h4 className="text-sm font-medium">面板显示</h4>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={mode === "focus"}
        onClick={() => setMode(mode === "focus" ? useWorkbenchMode.getState().resumeMode : "focus")}
      >
        专注聊天
      </Button>
      <p className="text-sm text-muted-foreground">收起面板，随时恢复。配色在下方独立选择。</p>
      <Button variant="outline" size="sm" onClick={applyClawd}>
        使用作者的 Clawd 配色
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
