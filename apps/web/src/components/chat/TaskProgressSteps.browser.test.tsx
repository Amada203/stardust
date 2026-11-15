import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { act, fakeTimers, render } from "../../../test/render";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { TaskProgressSteps } from "./TaskProgressSteps";

function progress(current: number): TaskProgressSnapshot {
  return {
    steps: Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      text: `Step ${index + 1}`,
      status: index < current ? "completed" : index === current ? "running" : "pending",
    })),
    completed: current,
    total: 9,
    remaining: 9 - current,
    state: "running",
    stale: false,
  };
}

it("keeps the current step visible in a compact window as progress advances", async () => {
  await using screen = await render(<TaskProgressSteps progress={progress(2)} compact />);
  await expect.element(screen.getByText("Step 3", { exact: true })).toBeVisible();
  await screen.rerender(<TaskProgressSteps progress={progress(7)} compact />);
  await expect.element(screen.getByText("Step 8", { exact: true })).toBeVisible();
  expect(screen.container.querySelector('[aria-current="step"]')?.textContent).toContain("Step 8");
  expect(
    screen.container.querySelectorAll("ol li[aria-current], ol li:has([dir=auto])"),
  ).toHaveLength(5);
  await expect.element(screen.getByText("4 earlier steps")).toBeVisible();
});

it("collapses with the keyboard while keeping live completion counts visible", async () => {
  await using screen = await render(<TaskProgressSteps progress={progress(2)} />);
  await userEvent.tab();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByRole("button", { name: "Task steps 2/9 completed" }))
    .toHaveAttribute("aria-expanded", "false");
  await expect.element(screen.container.querySelector("ol")!).not.toBeVisible();
  await screen.rerender(<TaskProgressSteps progress={{ ...progress(3), state: "approval" }} />);
  await expect
    .element(screen.getByRole("button", { name: "Task steps 3/9 completed" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("Waiting for approval", { exact: true }).first())
    .toBeVisible();
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByText("Step 4", { exact: true })).toBeVisible();
});

it("uses real activity rows, caps them at three, opens files and shows no invented details", async () => {
  const open = vi.fn();
  await using screen = await render(
    <TaskProgressSteps
      progress={progress(1)}
      variant="trail"
      details={{
        choices: [],
        activities: {
          "1": [0, 1, 2, 3].map((index) => ({
            id: String(index),
            kind: "read",
            label: "读取",
            path: `file-${index}.md`,
          })),
        },
      }}
      onOpenFile={open}
    />,
  );
  expect(screen.container.querySelectorAll(".combo-activity")).toHaveLength(3);
  await screen.getByRole("button", { name: "file-0.md" }).click();
  expect(open).toHaveBeenCalledWith("file-0.md");
  await expect.element(screen.getByText("+1", { exact: true })).toBeVisible();
  await screen.rerender(<TaskProgressSteps progress={progress(1)} variant="trail" />);
  expect(screen.container.querySelector(".combo-activities")).toBeNull();
  expect(screen.container.querySelector("[data-task-trail-decision]")).toBeNull();
});

it("remembers collapse per conversation and collapses completion once after 900ms", async () => {
  localStorage.removeItem("t3code:task-trail-expanded:v1:test-trail");
  await using screen = await render(
    <TaskProgressSteps progress={progress(1)} variant="trail" expansionKey="test-trail" />,
  );
  using _timers = fakeTimers();
  const heading = () => screen.container.querySelector<HTMLButtonElement>(".combo-bar")!;
  await act(() => heading().click());
  await screen.rerender(
    <TaskProgressSteps progress={progress(2)} variant="trail" expansionKey="test-trail" />,
  );
  expect(heading().getAttribute("aria-expanded")).toBe("false");
  await screen.rerender(null);
  await screen.rerender(
    <TaskProgressSteps progress={progress(2)} variant="trail" expansionKey="test-trail" />,
  );
  expect(heading().getAttribute("aria-expanded")).toBe("false");
  await act(() => heading().click());
  await screen.rerender(
    <TaskProgressSteps
      progress={{ ...progress(9), state: "complete" }}
      variant="trail"
      expansionKey="test-trail"
    />,
  );
  await act(() => vi.advanceTimersByTimeAsync(899));
  expect(heading().getAttribute("aria-expanded")).toBe("true");
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(heading().getAttribute("aria-expanded")).toBe("false");
  await act(() => heading().click());
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(heading().getAttribute("aria-expanded")).toBe("true");
  expect(screen.container.querySelectorAll("[data-task-trail-spinner]")).toHaveLength(0);
  localStorage.removeItem("t3code:task-trail-expanded:v1:test-trail");
});

it("runs one spinner only while working and limits motion to the changed title and completion check", async () => {
  await using screen = await render(<TaskProgressSteps progress={progress(1)} variant="trail" />);
  using animate = vi.spyOn(Element.prototype, "animate");
  expect(screen.container.querySelectorAll("[data-task-trail-spinner]")).toHaveLength(1);
  await screen.rerender(<TaskProgressSteps progress={progress(2)} variant="trail" />);
  expect(animate).toHaveBeenCalledTimes(2);
  expect(
    animate.mock.calls.every(
      ([, options]) => typeof options === "object" && options.duration === 350,
    ),
  ).toBe(true);
  animate.mockClear();
  await screen.rerender(<TaskProgressSteps progress={progress(2)} variant="trail" />);
  expect(animate).not.toHaveBeenCalled();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _query = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  await screen.rerender(
    <TaskProgressSteps progress={{ ...progress(3), state: "input" }} variant="trail" />,
  );
  expect(animate).not.toHaveBeenCalled();
  expect(screen.container.querySelectorAll("[data-task-trail-spinner]")).toHaveLength(0);
  await expect.element(screen.getByText("需你判断")).toBeVisible();
});

it("keeps a pending decision actionable even if the provider marked every step complete", async () => {
  await using screen = await render(
    <TaskProgressSteps
      progress={{ ...progress(9), state: "input" }}
      variant="trail"
      decision={<div data-task-trail-decision="">请选择方向</div>}
    />,
  );
  await expect.element(screen.getByText("需你判断")).toBeVisible();
  expect(
    screen.container.querySelector('[aria-current="step"] .combo-mark')?.getAttribute("data-mode"),
  ).toBe("need");
  expect(screen.container.querySelector(".combo-bar")?.textContent).not.toContain("9 步完成");
});
