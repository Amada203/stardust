import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import * as DateTime from "effect/DateTime";
import type { TaskProgressSnapshot } from "../../taskProgress";

export type TrailTool = "read" | "write" | "command" | "image" | "search" | "delegate";
export interface TrailActivity {
  id: string;
  kind: TrailTool;
  label: string;
  path?: string;
}
export interface TrailDetails {
  activities: Record<string, TrailActivity[]>;
  fileCount?: number;
  durationMs?: number;
  choices: string[];
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const field = (value: unknown, keys: string[]) => {
  const object = record(value);
  for (const key of keys) if (typeof object?.[key] === "string") return object[key];
  return undefined;
};

export function trailActivity(item: ThreadStructure["turnItems"][number]): TrailActivity[] {
  const base = { id: item.id };
  switch (item.type) {
    case "file_change":
      return [{ ...base, kind: "write", label: "写入", path: item.fileName }];
    case "command_execution":
      return [{ ...base, kind: "command", label: `运行 ${item.input}` }];
    case "file_search":
      return [{ ...base, kind: "search", label: `搜索 ${item.pattern ?? item.title ?? "文件"}` }];
    case "web_search":
      return [
        {
          ...base,
          kind: "search",
          label: `搜索 ${item.patterns?.join(" · ") ?? item.title ?? "网页"}`,
        },
      ];
    case "subagent":
      return [{ ...base, kind: "delegate", label: `委派 ${item.title ?? item.driver}` }];
    case "dynamic_tool": {
      const name = item.toolName?.toLowerCase() ?? "";
      const path = field(item.input, ["file_path", "path", "filename", "file"]);
      if (
        /(^|[_./])(read|read_file|view_image|open_file)$/.test(name) &&
        (path || item.viewedImagePath)
      ) {
        return [{ ...base, kind: "read", label: "读取", path: path ?? item.viewedImagePath! }];
      }
      if (/(write_file|edit_file|write|edit)$/.test(name) && path) {
        return [{ ...base, kind: "write", label: "写入", path }];
      }
      if (/imagegen|generate_image|image_gen/.test(name)) {
        const outputPath = field(item.output, ["path", "file_path", "output_path"]);
        return [
          {
            ...base,
            kind: "image",
            label: "生成图片",
            ...(outputPath ? { path: outputPath } : {}),
          },
        ];
      }
      return [];
    }
    default:
      return [];
  }
}

export function taskTrailDetails(
  progress: TaskProgressSnapshot,
  projection: ThreadStructure | null,
): TrailDetails {
  const result: TrailDetails = { activities: {}, choices: [] };
  if (!projection || progress.planId === undefined) return result;
  const plan = projection.plans.find((entry) => entry.id === progress.planId);
  if (!plan) return result;
  const items = projection.turnItems.filter(
    (item) => item.runId === plan.runId && (plan.runId !== null || item.nodeId === plan.nodeId),
  );
  const observedEnd = items.reduce(
    (latest, item) =>
      Math.max(
        latest,
        item.startedAt ? DateTime.toEpochMillis(item.startedAt) + 1 : 0,
        item.completedAt ? DateTime.toEpochMillis(item.completedAt) + 1 : 0,
      ),
    0,
  );
  const history = items
    .filter((item) => item.type === "todo_list" && item.planId === plan.id)
    .toSorted((a, b) => a.ordinal - b.ordinal);
  for (const step of progress.steps) {
    const windows: { start: number; end: number }[] = [];
    for (let index = 0; index < history.length; index++) {
      const snapshot = history[index]!;
      if (snapshot.type !== "todo_list") continue;
      const prior = snapshot.steps.find(
        (entry) => entry.id === step.id && entry.text === step.text,
      );
      if (prior?.status !== "running" || !prior.durationAnchorAt) continue;
      const start = Date.parse(prior.durationAnchorAt);
      const next = history
        .slice(index + 1)
        .find(
          (entry) =>
            entry.type === "todo_list" &&
            entry.steps.find((candidate) => candidate.id === step.id)?.status !== "running",
        );
      const end =
        next?.type === "todo_list"
          ? DateTime.toEpochMillis(next.updatedAt)
          : step.status === "running"
            ? observedEnd
            : Number.NaN;
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start)
        windows.push({ start, end });
    }
    if (step.status === "running" && step.durationAnchorAt && windows.length === 0) {
      const start = Date.parse(step.durationAnchorAt);
      const end = observedEnd;
      if (Number.isFinite(start) && end >= start) windows.push({ start, end });
    }
    if (windows.length === 0) continue;
    result.activities[step.id] = items.flatMap((item) => {
      if (!item.startedAt) return [];
      const time = DateTime.toEpochMillis(item.startedAt);
      return windows.some(({ start, end }) => time >= start && time < end)
        ? trailActivity(item)
        : [];
    });
  }
  const files = new Set(
    items.flatMap((item) =>
      item.status === "completed"
        ? trailActivity(item)
            .filter((entry) => entry.kind === "write" || entry.kind === "image")
            .flatMap((entry) => (entry.path ? [entry.path] : []))
        : [],
    ),
  );
  if (files.size > 0) result.fileCount = files.size;
  if (progress.steps.length > 0 && progress.steps.every((step) => step.durationMs !== undefined)) {
    result.durationMs = progress.steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
  }
  for (const item of items) {
    if (item.type !== "user_input_request") continue;
    const request = projection.runtimeRequests.find((entry) => entry.id === item.requestId);
    if (request?.status !== "resolved" || !request.answers) continue;
    for (const question of item.questions) {
      const answer = request.answers[question.id];
      const values = typeof answer === "string" ? [answer] : Array.isArray(answer) ? answer : [];
      for (const option of question.options)
        if (values.includes(option.value ?? option.label)) result.choices.push(option.label);
    }
  }
  return result;
}

export function primaryTrailTool(activities: readonly TrailActivity[]): TrailTool | undefined {
  const counts = new Map<TrailTool, number>();
  for (const activity of activities)
    counts.set(activity.kind, (counts.get(activity.kind) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}
