import "~/index.css";
import { expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { applyThemePalette } from "../../themePalette";
import { TaskProgressSteps } from "./TaskProgressSteps";
import { TaskTrailDecision } from "./TaskTrailDecision";
import type { TaskProgressSnapshot } from "../../taskProgress";
import type { TrailDetails } from "./taskTrailModel";

const titles = [
  "理解目标与整理素材",
  "生成 3 个可比较的方向",
  "等你选方向",
  "细化选中方向",
  "独立复核",
];
function progress(mode: "run" | "need" | "done"): TaskProgressSnapshot {
  const current = mode === "run" ? 1 : mode === "need" ? 2 : 5;
  return {
    steps: titles.map((text, index) => ({
      id: String(index),
      text,
      status: index < current ? "completed" : index === current ? "running" : "pending",
      ...(index < current ? { durationMs: [8000, 134000, 0, 182000, 41000][index]! } : {}),
    })),
    completed: current,
    total: 5,
    remaining: 5 - current,
    state: mode === "run" ? "running" : mode === "need" ? "input" : "complete",
    stale: false,
  };
}
const details: TrailDetails = {
  activities: {
    "0": [
      { id: "read", kind: "read", label: "读取", path: "品牌手册.pdf" },
      { id: "notes", kind: "write", label: "写入", path: "品牌色提取.md" },
    ],
    "1": ["a", "b", "c"].map((key) => ({
      id: key,
      kind: "image",
      label: "生成图片",
      path: `cover-${key}.png`,
    })),
  },
  choices: [],
};
it("renders real components in three states, fits narrow widths and captures the approved white decision card", async () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1000, 1000);
  await using _viewport = {
    [Symbol.asyncDispose]: () => page.viewport(viewport.width, viewport.height),
  };
  applyThemePalette("graphite", "light");
  const input = {
    requestId: "public-fixture",
    question: {
      id: "cover",
      header: "封面方向",
      question: "三个方向都已生成。选一个继续细化，其余保留在产物里。",
      options: [
        { label: "A 暖砂", value: "a", description: "明亮、温暖" },
        { label: "B 墨绿", value: "b", description: "沉稳、自然" },
        { label: "C 群青", value: "c", description: "简洁、理性" },
      ],
    },
    selectedValues: [],
    disabled: false,
    canAdvance: true,
    onSelect: () => {},
    onAdvance: () => {},
    onFocus: () => {},
  };
  const images = Object.fromEntries(
    [
      ["a", "#eadfce"],
      ["b", "#2f4a3e"],
      ["c", "#1f2a5c"],
    ].map(([key, color]) => [
      key!,
      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="130"><rect width="240" height="130" fill="${color}"/><circle cx="170" cy="65" r="32" fill="#ffffff55"/></svg>`)}`,
    ]),
  );
  const fixture = (mode: "run" | "need" | "done") => (
    <div
      data-testid="steps-fixture"
      className="w-[46rem] max-w-full bg-background p-5 text-foreground"
    >
      <p className="mb-1 text-xs text-muted-foreground">Codex · 示例数据 · 真实前端组件</p>
      <p className="mb-4 text-sm">先生成三个可比较的方向，等你挑一个再继续细化。</p>
      <TaskProgressSteps
        variant="trail"
        progress={progress(mode)}
        defaultExpanded={mode !== "done"}
        details={
          mode === "done"
            ? { ...details, choices: ["A 暖砂"], durationMs: 365000, fileCount: 6 }
            : details
        }
        onOpenFile={() => {}}
        {...(mode === "need"
          ? { decision: <TaskTrailDecision input={input} images={images} /> }
          : {})}
      />
      <div className="mt-4 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        输入问题，@ 添加文件，$ 使用技能…
      </div>
    </div>
  );
  await using screen = await render(null);
  for (const mode of ["run", "need", "done"] as const) {
    await screen.rerender(null);
    await screen.rerender(fixture(mode));
    const root = screen.getByTestId("steps-fixture").element() as HTMLElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    root.style.width = "320px";
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    root.style.width = "736px";
    if (mode === "done") expect(root.querySelector("[data-task-trail-spinner]")).toBeNull();
    if (import.meta.env.VITE_CAPTURE_C64 === "1")
      await page
        .getByTestId("steps-fixture")
        .screenshot({ path: `c64-steps-${mode}.png`, animations: "disabled" });
  }
  applyThemePalette("standard", "light");
});
