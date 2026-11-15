import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ThreadResumeCard } from "../chat/ThreadResumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { describe, expect, it, vi } from "vite-plus/test";
import { RunId, ThreadId } from "@t3tools/contracts";
import "~/index.css";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import type { SidebarThreadSummary } from "../../types";
import { useRightPanelStore } from "../../rightPanelStore";
import type { BoardData } from "../../taskBoard.logic";
import { WorkbenchInbox } from "./WorkbenchInbox";

const board = vi.hoisted(() => ({ data: null as BoardData | null }));

vi.mock("../../taskBoard", () => ({
  useTaskBoard: Object.assign(
    (select: (state: { error: null; data: BoardData | null }) => unknown) =>
      select({ error: null, data: board.data }),
    { setState: () => {} },
  ),
  mutateTaskBoard: async () => {},
  requestTaskBoardCard: () => {},
  focusTaskBoardItem: () => {},
}));
vi.mock("../../state/entities", () => ({
  useAllEnvironmentShellsBootstrapped: () => true,
  useQuietThreadProjection: () => null,
  useThreadShell: () => null,
}));
vi.mock("../../state/environments", () => ({
  useEnvironments: () => ({
    environments: [{ connection: { phase: "connected" } }],
    isReady: true,
  }),
  useEnvironment: () => null,
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));

const finished = (index: number): SidebarThreadSummary => ({
  ...makeThreadFixture({ id: ThreadId.make(`done-${index}`), title: `Done ${index}` }),
  lastVisitedAt: "2026-11-01T00:00:00.000Z",
  latestRun: {
    runId: RunId.make(`run-${index}`),
    status: "completed",
    requestedAt: null,
    startedAt: null,
    completedAt: `2026-11-02T00:0${index}:00.000Z`,
    assistantMessageId: null,
  },
});

describe("sidebar inbox", () => {
  it("lists unread, waiting and failed threads inline, five at a time, and opens them directly", async () => {
    const waiting = {
      ...makeThreadFixture({ id: ThreadId.make("ask"), title: "Needs answer" }),
      hasPendingUserInput: true,
    };
    const navigate = vi.fn();
    await using screen = await render(
      <WorkbenchInbox
        threads={[waiting, ...Array.from({ length: 6 }, (_, index) => finished(index))]}
        projects={[]}
        activeKey={null}
        navigate={navigate}
      />,
    );
    const openPanel = vi.spyOn(useRightPanelStore.getState(), "open");
    const list = screen.getByRole("list", { name: "待我处理的会话" });
    // Waiting first, then the oldest unread results; the rest stay behind "更多".
    await expect.element(list.getByRole("button", { name: /Needs answer/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /待回答/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /Done 3/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /Done 4/ })).not.toBeInTheDocument();
    await list.getByRole("button", { name: "更多 2" }).click();
    await list.getByRole("button", { name: /Done 5/ }).click();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ threadId: "done-5" }));
    // The section title is a label now: it no longer sends the user to the task panel.
    await screen.getByText("待我处理", { exact: true }).click();
    expect(openPanel).not.toHaveBeenCalled();
  });
});

it("removes attention state immediately while an inert row exits, including the last row", async () => {
  const waiting = {
    ...makeThreadFixture({ id: ThreadId.make("motion-ask"), title: "Motion answer" }),
    hasPendingUserInput: true,
  };
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={[waiting]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  using _timers = fakeTimers();
  const badge = screen.container.querySelector('[aria-label="需要回答 1 条"]')!;
  using bounce = vi.spyOn(badge, "animate");
  await screen.rerender(
    <WorkbenchInbox threads={[]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  const exit = screen.container.querySelector<HTMLElement>(".workbench-inbox-exit")!;
  expect(exit).not.toBeNull();
  expect(exit.inert).toBe(true);
  expect(exit.getAttribute("aria-hidden")).toBe("true");
  expect(screen.container.querySelector('[aria-label="需要回答 0 条"]')).not.toBeNull();
  expect(bounce).toHaveBeenCalledTimes(1);
  await act(() => {
    vi.advanceTimersByTime(350);
  });
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  expect(screen.container.querySelector('[aria-label="待我处理的会话"]')).toBeNull();
});

it("skips inbox exit and count animation when reduced motion is requested", async () => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  const waiting = {
    ...makeThreadFixture({ id: ThreadId.make("reduced-ask"), title: "Reduced answer" }),
    hasPendingUserInput: true,
  };
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={[waiting]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  using animate = vi.spyOn(Element.prototype, "animate");
  await screen.rerender(
    <WorkbenchInbox threads={[]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  expect(animate).not.toHaveBeenCalled();
});

it("does not exit hidden rows on collapse and restores a returning row before its exit deadline", async () => {
  const threads = Array.from({ length: 6 }, (_, index) => finished(index + 1));
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={threads} projects={[]} activeKey={null} navigate={navigate} />,
  );
  await screen.getByRole("button", { name: "更多 1" }).click();
  await screen.getByRole("button", { name: "收起", exact: true }).click();
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  using _timers = fakeTimers();
  await screen.rerender(
    <WorkbenchInbox
      threads={threads.slice(1)}
      projects={[]}
      activeKey={null}
      navigate={navigate}
    />,
  );
  expect(screen.container.querySelectorAll(".workbench-inbox-exit")).toHaveLength(1);
  await screen.rerender(
    <WorkbenchInbox threads={threads} projects={[]} activeKey={null} navigate={navigate} />,
  );
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  await act(() => {
    vi.advanceTimersByTime(350);
  });
  expect(screen.container.querySelector('[data-inbox-thread="done-1"]')).not.toBeNull();
});

it("only lists linked board attention and opens its conversation without a task panel", async () => {
  board.data = {
    tasks: Array.from({ length: 6 }, (_, index) => ({
      folder: `/work/task-${index}`,
      title: `Board task ${index}`,
      state: "user" as const,
      notify_key: `task-${index}`,
      snoozed: false,
      stale: false,
      age_days: 1,
      steps: [],
      missing: [],
      next: "Review",
      blocked: "",
      sessions: index === 0 ? ["linked"] : [],
      done_count: 0,
      total: 1,
      judge: "请确认交付",
    })),
    counts: { active: 6, user: 6, blocked: 0, agent: 0, stale: 0, done_week: 0, badge: 6 },
  };
  try {
    useRightPanelStore.setState({ byThreadKey: {} });
    const linked = makeThreadFixture({ id: ThreadId.make("linked"), title: "Linked thread" });
    const navigate = vi.fn();
    await using screen = await render(
      <WorkbenchInbox threads={[linked]} projects={[]} activeKey={null} navigate={navigate} />,
    );
    await expect.element(screen.getByRole("button", { name: /Board task 0/ })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Board task 5/ }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: /Board task 0/ }).click();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ threadId: "linked" }));
    expect(useRightPanelStore.getState().byThreadKey).toEqual({});
    await expect
      .element(screen.getByRole("button", { name: /Board task 1/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /任务板.*项待处理/ }))
      .not.toBeInTheDocument();
  } finally {
    board.data = null;
  }
});

it("sends the continuation from the selected thread and immediately removes its actionable row", async () => {
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  const thread = {
    ...makeThreadFixture({ id: ThreadId.make("continue-inbox"), title: "继续扫码任务" }),
    hasPendingUserInput: true,
  };
  const send = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  await using screen = await render(
    <>
      <WorkbenchInbox threads={[thread]} projects={[]} activeKey={null} navigate={() => {}} />
      <ThreadResumeCard
        threadRef={ref}
        progress={null}
        disabled={false}
        onContinue={send}
        onSnooze={undefined}
        onDismiss={undefined}
      />
    </>,
  );
  await screen
    .getByRole("list", { name: "待我处理的会话" })
    .getByRole("button", { name: /继续扫码任务/ })
    .click();
  await screen.getByRole("button", { name: "我处理好了，继续" }).click();
  expect(send).toHaveBeenCalledExactlyOnceWith("已处理好，继续。");
  await expect
    .element(
      screen
        .getByRole("list", { name: "待我处理的会话" })
        .getByRole("button", { name: /继续扫码任务/ }),
    )
    .not.toBeInTheDocument();
});
