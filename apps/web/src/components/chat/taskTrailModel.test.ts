import { expect, it } from "vite-plus/test";
import * as DateTime from "effect/DateTime";
import {
  NodeId,
  PlanId,
  RunId,
  TurnItemId,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { makeThreadProjectionFixture } from "../../test-fixtures";
import { taskTrailDetails } from "./taskTrailModel";
import type { TaskProgressSnapshot } from "../../taskProgress";

function fixture() {
  const projection = makeThreadProjectionFixture();
  const at = (seconds: number) =>
    DateTime.makeUnsafe(`2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`);
  const runId = RunId.make("run");
  const planId = PlanId.make("plan");
  const nodeId = NodeId.make("node");
  const base = (id: string, second: number) => ({
    id: TurnItemId.make(id),
    threadId: projection.thread.id,
    runId,
    nodeId,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal: second,
    status: "completed" as const,
    title: null,
    startedAt: at(second),
    completedAt: at(second),
    updatedAt: at(second),
  });
  const first = {
    id: "a",
    text: "Read brief",
    status: "running" as const,
    durationAnchorAt: "2026-01-01T00:00:01.000Z",
  };
  const second = {
    id: "b",
    text: "Write",
    status: "running" as const,
    durationAnchorAt: "2026-01-01T00:00:10.000Z",
  };
  const steps = [
    { id: "a", text: "Read brief", status: "completed" as const, durationMs: 9000 },
    second,
  ];
  const items: OrchestrationV2TurnItem[] = [
    {
      ...base("plan-1", 1),
      type: "todo_list",
      planId,
      steps: [first, { id: "b", text: "Write", status: "pending" }],
    },
    {
      ...base("read", 2),
      type: "dynamic_tool",
      toolName: "read_file",
      input: { path: "brief.md" },
    },
    { ...base("plan-2", 10), type: "todo_list", planId, steps },
    { ...base("write", 10), type: "file_change", fileName: "answer.md" },
    {
      ...base("wrong-run", 11),
      runId: RunId.make("other"),
      type: "file_change",
      fileName: "other.md",
    },
    { ...base("no-time", 12), startedAt: null, type: "file_change", fileName: "unknown.md" },
  ];
  const progress: TaskProgressSnapshot = {
    planId,
    steps,
    completed: 1,
    total: 2,
    remaining: 1,
    state: "running",
    stale: false,
  };
  return {
    progress,
    projection: {
      ...projection,
      updatedAt: at(20),
      turnItems: items,
      plans: [
        {
          id: planId,
          threadId: projection.thread.id,
          runId,
          nodeId,
          kind: "todo_list" as const,
          status: "active" as const,
          steps,
        },
      ],
    },
  };
}
it("assigns activities only to proven running windows, exclusive at step boundaries and scoped to the run", () => {
  const { progress, projection } = fixture();
  const details = taskTrailDetails(progress, projection);
  expect(details.activities.a?.map((entry) => entry.path)).toEqual(["brief.md"]);
  expect(details.activities.b?.map((entry) => entry.path)).toEqual(["answer.md"]);
  expect(details.durationMs).toBeUndefined();
});
it("omits historical rows without a running window, pending anchors and absent projections", () => {
  const { progress, projection } = fixture();
  const onlyLatest = {
    ...projection,
    turnItems: projection.turnItems.filter((item) => item.id !== "plan-1"),
  };
  expect(taskTrailDetails(progress, onlyLatest).activities.a).toBeUndefined();
  const { planId: _planId, ...withoutPlan } = progress;
  expect(taskTrailDetails(withoutPlan, projection).activities).toEqual({});
  expect(taskTrailDetails(progress, null)).toEqual({ activities: {}, choices: [] });
});
