import {
  resolveSnoozePresets as defaultPresets,
  pickSnoozePreset as pickDefaultPreset,
} from "@t3tools/client-runtime/state/thread-settled";
import { useNowMinute } from "../hooks/useNowMinute";
import { Fragment, useEffect, useRef, useState } from "react";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  Eye,
  Hand,
  LockKeyhole,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Video,
  MessageSquare,
  ExternalLink,
  Unplug,
  Copy,
} from "lucide-react";
import {
  useTaskBoard,
  setTaskBoardCwd,
  mutateTaskBoard,
  refreshTaskBoard,
  TASK_BOARD_START_COMMAND,
  requestTaskBoardCurrent,
} from "../taskBoard";
import {
  boardStateLabel,
  boardTaskMatchesFilter,
  matchBoardTask,
  type BoardTask,
  boardCurrentStep,
  boardTaskKind,
  boardTaskHeading,
  boardWaitDays,
  boardTaskGroup,
  sortBoardTasks,
  boardProgress,
  boardLevelRank,
  boardApprovalsToday,
  boardEvidenceTarget,
} from "../taskBoard.logic";
import { useRightPanelStore } from "../rightPanelStore";
import { useThreadShells, useProjects } from "../state/entities";
import { Button } from "./ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "./ui/menu";
import { resolveSnoozePresets, pickSnoozePreset, type SnoozePreset } from "./Sidebar.snooze";
import { requestCustomSnooze } from "./CustomSnoozeDialog";
import { shellEnvironment } from "../state/shell";
import { useAtomCommand } from "../state/use-atom-command";
import { toastManager } from "./ui/toast";
import { TaskInbox } from "./TaskInbox";

export function TaskBoardSnooze({
  task,
  environmentId,
}: {
  task: BoardTask;
  environmentId?: EnvironmentId | undefined;
}) {
  const [presets, setPresets] = useState<ReadonlyArray<SnoozePreset>>([]);
  const save = async (until: string) => {
    try {
      await mutateTaskBoard("snooze", { folder: task.folder, until });
    } catch (error) {
      toastManager.add({ type: "error", title: String(error) });
    }
  };
  return (
    <Menu
      onOpenChange={(open) => {
        if (open)
          setPresets(
            environmentId
              ? resolveSnoozePresets(new Date(), "locale", environmentId)
              : defaultPresets(new Date()),
          );
      }}
    >
      <MenuTrigger render={<Button size="xs" variant="outline" />}>稍后提醒</MenuTrigger>
      <MenuPopup>
        {presets.map((preset) => (
          <MenuItem
            key={preset.id}
            onClick={() => {
              const picked = environmentId
                ? pickSnoozePreset(presets, preset.id, "locale", environmentId)
                : pickDefaultPreset({ shown: presets, id: preset.id, now: new Date() });
              if (picked) void save(picked.snoozedUntil);
            }}
          >
            {preset.label} · {preset.whenLabel}
          </MenuItem>
        ))}
        <MenuItem
          onClick={async () => {
            const choice = await requestCustomSnooze();
            if (choice) await save(choice.snoozedUntil);
          }}
        >
          自定义…
        </MenuItem>
        {task.snoozed ? <MenuItem onClick={() => void save("")}>取消稍后提醒</MenuItem> : null}
      </MenuPopup>
    </Menu>
  );
}
export function TaskBoardBadge() {
  // Same rule as the sidebar entry and the inbox: requests that need the user, not snoozed.
  const count = useTaskBoard((s) =>
    s.error
      ? 0
      : (s.data?.tasks.filter(
          (task) => !task.snoozed && (task.state === "user" || task.state === "blocked"),
        ).length ?? 0),
  );
  return count ? (
    <span className="rounded-full bg-warning/15 px-1.5 text-3xs tabular-nums text-warning-foreground">
      {count}
    </span>
  ) : null;
}
export function TaskBoardDot({ cwd, threadId }: { cwd: string | null; threadId: string }) {
  const state = useTaskBoard((s) =>
    s.error ? null : matchBoardTask(s.data?.tasks ?? [], cwd, threadId)?.state,
  );
  if (!state || state === "done") return null;
  return (
    <span
      aria-label={`项目任务：${boardStateLabel[state]}`}
      className={`size-1.5 shrink-0 rounded-full ${state === "user" ? "bg-warning" : state === "blocked" ? "bg-destructive" : "bg-primary"}`}
    />
  );
}

function TaskProgress({
  task,
  mini = false,
  caption = true,
}: {
  task: BoardTask;
  mini?: boolean;
  caption?: boolean;
}) {
  const { currentIndex, nextGateDistance } = boardProgress(task);
  const step = boardCurrentStep(task);
  return (
    <div className={mini ? "w-24 shrink-0" : "min-w-0"}>
      <div
        role="img"
        aria-label={`${task.done_count}/${task.total} 步通过${step ? `，当前：${step.name}` : ""}`}
        className={`flex items-center ${mini ? "h-4" : "h-5"}`}
      >
        {task.steps.map((s, index) => (
          <Fragment key={s.id}>
            {index ? (
              <span
                aria-hidden
                className={`h-0.5 min-w-0 flex-1 ${task.steps[index - 1]?.done ? "bg-success" : "bg-border"}`}
              />
            ) : null}
            {index === currentIndex ? (
              <span
                data-task-station={s.id}
                data-current-station={task.state}
                aria-label={`${s.name}：${boardStateLabel[task.state]}`}
                className={`grid shrink-0 place-items-center rounded-full font-bold text-primary-foreground ${mini ? "size-3.5 text-4xs" : "size-5 text-3xs ring-3"} ${task.state === "blocked" ? "bg-destructive ring-destructive/10" : task.state === "user" ? "bg-warning ring-warning/10" : "bg-primary ring-primary/10"}`}
              >
                {task.state === "blocked" ? (
                  <LockKeyhole className={mini ? "size-2" : "size-3"} />
                ) : task.state === "user" ? (
                  "你"
                ) : (
                  "AI"
                )}
              </span>
            ) : (
              <span
                data-task-station={s.id}
                data-task-gate={s.required === "user" || undefined}
                aria-label={`${s.name}${s.required === "user" ? "：你把关" : ""}${s.done ? "，已通过" : ""}`}
                className={`shrink-0 border-2 ${mini ? "size-1.5" : "size-2"} ${s.done ? "border-success bg-success" : "border-border bg-background"} ${s.required === "user" ? "rotate-45 rounded-xs" : "rounded-full"}`}
              />
            )}
          </Fragment>
        ))}
      </div>
      {!mini && caption ? (
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5 text-3xs text-muted-foreground">
          <span className="min-w-0 break-words">
            {step ? `当前：${step.name}` : "所有步骤已通过"}
          </span>
          <span>
            {task.done_count}/{task.total}
            {nextGateDistance !== null ? ` · 下个关卡还有 ${nextGateDistance} 站` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
function TaskSteps({ task }: { task: BoardTask }) {
  const current = boardCurrentStep(task);
  const levels = ["self", "review", "user"] as const;
  const labels = ["自检", "评审", "你确认"];
  return (
    <ol aria-label={`${task.title}完整步骤`} className="space-y-1">
      {task.steps.map((step) => (
        <li
          key={step.id}
          data-current-step={step.id === current?.id || undefined}
          className={`flex min-h-6 items-center gap-2.5 text-xs ${step.id === current?.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        >
          <span
            aria-hidden
            className={`size-2 shrink-0 border-2 ${step.done ? "border-success bg-success" : step.id === current?.id ? (task.state === "blocked" ? "border-destructive bg-destructive" : task.state === "agent" ? "border-primary bg-primary" : "border-warning bg-warning") : "border-border"} ${step.required === "user" ? "rotate-45 rounded-xs" : "rounded-full"}`}
          />
          <span className="min-w-0 flex-1 break-words">
            {step.name}
            {step.id === current?.id
              ? task.state === "user"
                ? step.pending_review
                  ? " · 等你判断"
                  : " · 你来做"
                : task.state === "blocked"
                  ? " · 卡住了"
                  : " · Agent 在做"
              : ""}
          </span>
          {step.done || step.id === current?.id || boardLevelRank(step) > 0 ? (
            <span
              className="flex shrink-0 gap-0.5"
              aria-label={`验收等级：${labels[boardLevelRank(step) - 1] ?? "未完成"}`}
            >
              {levels.map((level, index) => (
                <span
                  key={level}
                  aria-label={`${labels[index]}：${boardLevelRank(step) > index ? "已通过" : step.required === level ? "还需验收" : "未通过"}`}
                  className={`h-1 w-2.5 rounded-xs ${boardLevelRank(step) > index ? "bg-success" : step.required === level ? "border border-dashed border-warning" : "bg-border"}`}
                />
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
function TaskPrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6.5 items-center justify-center gap-1 rounded-lg border border-foreground bg-foreground px-2.5 text-xs font-medium text-background outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
export function TaskBoardPanel({
  cwd,
  threadRef,
}: {
  cwd: string | null;
  threadRef: ScopedThreadRef;
}) {
  const { data, error, loading, entry, reveal } = useTaskBoard();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}Z`);
  const activeHint = entry?.threadKey === scopedThreadKey(threadRef) ? entry : null;
  const [selection, setSelection] = useState<{
    view: "waiting" | "current" | "all";
    revision: number;
  }>({ view: "waiting", revision: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [completedOpen, setCompletedOpen] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const threads = useThreadShells();
  const projects = useProjects();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The service resolves the workspace and symlinks for its current-project response.
  useEffect(() => {
    void setTaskBoardCwd(cwd);
  }, [cwd]);
  const current = matchBoardTask(data?.tasks ?? [], cwd, threadRef.threadId);
  const requestedView =
    activeHint && activeHint.revision !== selection.revision ? "current" : selection.view;
  const view = requestedView;
  const choose = (next: typeof selection.view) => {
    setSelection({ view: next, revision: activeHint?.revision ?? 0 });
    setMutationError(null);
  };
  const scrollKey =
    view === "current" ? `${current?.folder}:${current?.current_id}:${activeHint?.revision}` : null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Bring the requested current step into the panel viewport after thread navigation commits.
  useEffect(() => {
    if (scrollKey)
      bodyRef.current
        ?.querySelector<HTMLElement>("[data-current-step=true]")
        ?.scrollIntoView({ block: "nearest" });
  }, [scrollKey]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- External attention entries reveal a task without changing the current conversation.
  useEffect(() => {
    if (!reveal) return;
    // oxlint-disable-next-line react/set-state-in-effect -- Apply an external task reveal request after this panel mounts.
    setSelection({ view: "waiting", revision: activeHint?.revision ?? 0 });
    setHighlight(reveal.folder);
    const timer = setTimeout(() => setHighlight(null), 1000);
    return () => clearTimeout(timer);
  }, [reveal, activeHint?.revision]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Scroll the committed task card after an external reveal request.
  useEffect(() => {
    if (highlight)
      bodyRef.current
        ?.querySelector<HTMLElement>(`[data-task-folder="${CSS.escape(highlight)}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  const tasks = sortBoardTasks(data?.tasks ?? []);
  const attention = tasks.filter(
    (task) => !task.snoozed && (task.state === "user" || task.state === "blocked"),
  );
  const firstAttention = ["judge", "do", "blocked"].flatMap((group) =>
    attention.filter((task) => boardTaskGroup(task) === group),
  )[0]?.folder;
  const approvals = boardApprovalsToday(tasks, new Date(now));
  const linkedThreads = (task: BoardTask) =>
    threads
      .filter(
        (thread) =>
          task.sessions.includes(thread.id) ||
          (() => {
            const project = projects.find(
              (p) => p.id === thread.projectId && p.environmentId === thread.environmentId,
            );
            return matchBoardTask([task], thread.worktreePath ?? project?.workspaceRoot) !== null;
          })(),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const openThread = (ref: ScopedThreadRef) => {
    requestTaskBoardCurrent(ref);
    useRightPanelStore.getState().open(ref, "tasks");
    void navigate({ to: "/$environmentId/$threadId", params: ref });
  };
  const openProject = async (task: BoardTask) => {
    toastManager.add({
      type: "info",
      title: "这个项目还没关联会话",
      description: "正在打开项目文件夹。",
    });
    const result = await openInEditor({
      environmentId: threadRef.environmentId,
      input: { cwd: task.folder, editor: "file-manager" },
    });
    if (result._tag === "Failure") setMutationError(`无法打开项目文件夹：${task.folder}`);
  };
  const openTask = (task: BoardTask) => {
    const thread = linkedThreads(task)[0];
    if (thread) openThread(scopeThreadRef(thread.environmentId, thread.id));
    else void openProject(task);
  };
  const openEvidence = (task: BoardTask, evidence: string) => {
    const target = boardEvidenceTarget(task.folder, evidence);
    const linked = linkedThreads(task)[0];
    const ref = linked
      ? scopeThreadRef(linked.environmentId, linked.id)
      : current?.folder === task.folder
        ? threadRef
        : null;
    if (!target || target.kind !== "file" || !ref) {
      setMutationError("没有可预览此证据的关联会话，请先打开项目会话。");
      return;
    }
    useRightPanelStore.getState().openFile(ref, target.value);
    void navigate({ to: "/$environmentId/$threadId", params: ref });
  };
  const save = async (task: BoardTask, decision: "approve" | "reject" | "toggle") => {
    const step = boardCurrentStep(task);
    if (!step || pending) return;
    if (decision === "reject" && !reason.trim()) {
      setMutationError("请写一句打回原因。");
      return;
    }
    setPending(task.folder);
    setMutationError(null);
    try {
      if (decision === "toggle")
        await mutateTaskBoard("toggle", { folder: task.folder, step: step.id });
      else
        await mutateTaskBoard("review", {
          folder: task.folder,
          step: step.id,
          decision,
          ...(decision === "reject" ? { reason: reason.trim() } : {}),
        });
      setRejecting(null);
      setReason("");
    } catch (error) {
      setMutationError(String(error));
    } finally {
      setPending(null);
    }
  };
  const linkSession = async (
    task: BoardTask,
    session: string,
    title: string,
    action: "link" | "unlink" = "link",
  ) => {
    try {
      await mutateTaskBoard("link", {
        folder: task.folder,
        session,
        title,
        action,
        source: "manual",
      });
    } catch (error) {
      setMutationError(String(error));
    }
  };
  const links = (task: BoardTask, label = "打开会话") => {
    const linked = linkedThreads(task);
    if (!linked.length)
      return (
        <div className="flex flex-wrap gap-1.5">
          <Menu>
            <MenuTrigger render={<Button size="xs" variant="outline" />}>关联会话</MenuTrigger>
            <MenuPopup>
              {[...threads]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 10)
                .map((thread) => (
                  <MenuItem
                    key={`${thread.environmentId}:${thread.id}`}
                    onClick={() => void linkSession(task, thread.id, thread.title)}
                  >
                    {thread.title}
                  </MenuItem>
                ))}
            </MenuPopup>
          </Menu>
          <Button size="xs" variant="outline" onClick={() => void openProject(task)}>
            打开项目文件夹
          </Button>
        </div>
      );
    if (linked.length === 1)
      return (
        <Button
          size="xs"
          variant="outline"
          title={linked[0]!.title}
          onClick={() => openThread(scopeThreadRef(linked[0]!.environmentId, linked[0]!.id))}
        >
          <MessageSquare />
          {label}
        </Button>
      );
    return (
      <Menu>
        <MenuTrigger render={<Button size="xs" variant="outline" />}>
          <MessageSquare />
          {label} {linked.length}
        </MenuTrigger>
        <MenuPopup>
          {linked.slice(0, 5).map((thread) => (
            <Fragment key={`${thread.environmentId}:${thread.id}`}>
              <MenuItem onClick={() => openThread(scopeThreadRef(thread.environmentId, thread.id))}>
                {thread.title} · {thread.updatedAt.slice(0, 10)}
              </MenuItem>
              <MenuItem onClick={() => void linkSession(task, thread.id, thread.title, "unlink")}>
                取消关联
              </MenuItem>
            </Fragment>
          ))}
        </MenuPopup>
      </Menu>
    );
  };
  const evidenceTags = (task: BoardTask) => (
    <div className="pointer-events-auto mt-1 flex flex-wrap gap-1">
      {(boardCurrentStep(task)?.evidence ?? []).map((evidence) => {
        const target = boardEvidenceTarget(task.folder, evidence);
        const label = evidence.split("/").at(-1) || evidence;
        const Icon = /\.(png|jpe?g|webp|gif|avif)$/i.test(evidence)
          ? Image
          : /\.(mp4|mov|webm)$/i.test(evidence)
            ? Video
            : FileText;
        const classes =
          "inline-flex max-w-full items-center gap-1 rounded-md bg-accent px-1.5 py-1 text-3xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";
        return target?.kind === "url" ? (
          <a
            key={evidence}
            href={target.value}
            target="_blank"
            rel="noreferrer"
            className={classes}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        ) : (
          <button
            key={evidence}
            type="button"
            disabled={!target}
            className={classes}
            onClick={() => openEvidence(task, evidence)}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
  const card = (task: BoardTask, forceCurrent = false, first = false) => {
    const kind = boardTaskKind(task),
      step = boardCurrentStep(task),
      waitingDays = boardWaitDays(task, now);
    const isOpen = expanded[task.folder] ?? (view === "waiting" && first);
    const kindLabel =
      task.state === "done"
        ? "已完成"
        : task.state === "agent"
          ? "推进中"
          : kind === "review"
            ? "验收"
            : kind === "decide"
              ? "决定"
              : kind === "unlock" || kind === "blocked"
                ? "解锁"
                : (step?.name.match(/口播|录音|拍摄|上传|补充|填写/)?.[0] ?? "动手");
    const actionable = task.state === "user" || task.state === "blocked";
    return (
      <article
        key={task.folder}
        aria-label={task.title}
        data-task-folder={task.folder}
        data-highlighted={highlight === task.folder || undefined}
        style={{ borderRadius: "calc(var(--radius) + 2px)" }}
        className={`relative mx-2 mb-1.5 border data-highlighted:ring-2 data-highlighted:ring-warning bg-background px-3 py-2.5 ${isOpen || forceCurrent ? "border-warning/40" : "border-border hover:border-foreground/20"}`}
      >
        {!forceCurrent ? (
          <button
            type="button"
            aria-label={`${isOpen ? "收起" : "展开"}${task.title}步骤`}
            aria-expanded={isOpen}
            onClick={() => setExpanded((previous) => ({ ...previous, [task.folder]: !isOpen }))}
            className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        ) : null}
        <div className="pointer-events-none relative">
          <div className="flex min-w-0 items-center gap-1.5 text-3xs text-muted-foreground">
            <span
              className={`shrink-0 rounded-sm px-1.5 py-0.5 font-semibold ${task.state === "blocked" ? "bg-destructive/10 text-destructive" : task.state === "agent" ? "bg-primary/10 text-primary" : task.state === "done" ? "bg-success/10 text-success-foreground" : "bg-warning/10 text-warning-foreground"}`}
            >
              {kindLabel}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {forceCurrent
                ? task.state === "user"
                  ? "轮到你"
                  : boardStateLabel[task.state]
                : task.title}
            </span>
            <span className="shrink-0">
              {task.snoozed
                ? "稍后提醒"
                : waitingDays === null
                  ? ""
                  : waitingDays === 0
                    ? "今天"
                    : `等 ${waitingDays} 天`}
            </span>
          </div>
          <h3 className="mt-1.5 break-words text-sm leading-snug font-semibold">
            {task.state === "agent"
              ? task.next || step?.name || "Agent 在推进"
              : boardTaskHeading(task)}
          </h3>
          {evidenceTags(task)}
          {task.missing.length ? (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              缺：{task.missing.join(" · ")}
            </p>
          ) : null}
          {!forceCurrent ? (
            <div className="mt-3">
              <TaskProgress task={task} />
            </div>
          ) : null}
          {!forceCurrent && isOpen ? (
            <div className="mt-2.5 border-t pt-1.5">
              <TaskSteps task={task} />
            </div>
          ) : null}
          <div className="pointer-events-auto mt-2.5 flex flex-wrap gap-1.5">
            {actionable && (kind === "unlock" || kind === "blocked") ? (
              <TaskPrimaryButton onClick={() => openTask(task)}>
                <ExternalLink className="size-3" />
                去处理
              </TaskPrimaryButton>
            ) : actionable && kind === "review" ? (
              <>
                <TaskPrimaryButton
                  disabled={pending !== null || !step}
                  onClick={() => void save(task, "approve")}
                >
                  <Check className="size-3" />
                  通过
                </TaskPrimaryButton>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pending !== null || !step}
                  onClick={() => {
                    setRejecting(rejecting === task.folder ? null : task.folder);
                    setReason("");
                    setMutationError(null);
                  }}
                >
                  打回…
                </Button>
              </>
            ) : actionable && kind === "decide" ? (
              <TaskPrimaryButton
                disabled={pending !== null || !step}
                onClick={() => void save(task, "approve")}
              >
                我决定了
              </TaskPrimaryButton>
            ) : actionable ? (
              <>
                <TaskPrimaryButton
                  disabled={pending !== null || !step}
                  onClick={() => void save(task, "toggle")}
                >
                  我做完了
                </TaskPrimaryButton>
                <TaskBoardSnooze task={task} environmentId={threadRef.environmentId} />
              </>
            ) : null}
            {links(task)}
            {task.snoozed && kind !== "do" ? (
              <TaskBoardSnooze task={task} environmentId={threadRef.environmentId} />
            ) : null}
          </div>
          {rejecting === task.folder ? (
            <form
              className="pointer-events-auto mt-2 flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void save(task, "reject");
              }}
            >
              <input
                aria-label="打回原因"
                placeholder="一句话说明哪里需要改"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              />
              <Button
                type="submit"
                size="xs"
                variant="outline"
                disabled={!reason.trim() || pending !== null}
              >
                确认打回
              </Button>
            </form>
          ) : null}
        </div>
      </article>
    );
  };
  const allTasks = tasks.filter((task) => task.state !== "done");
  const complete = tasks.filter((task) => boardTaskMatchesFilter(task, "done_week", now));
  return (
    <section
      aria-label="任务看板"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      {error ? (
        <div role="status" className="px-6 py-10 text-center text-xs text-muted-foreground">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-accent">
            <Unplug className="size-5" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">看板服务没开</h2>
          <p>任务数据暂时读不到，T3 其他功能不受影响。</p>
          <code className="my-3 block break-all rounded-md bg-accent px-2 py-1.5 text-left text-3xs">
            {TASK_BOARD_START_COMMAND}
          </code>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                .writeText(TASK_BOARD_START_COMMAND)
                .then(() => setCopied(true))
                .catch(() => setMutationError("复制失败，请手动复制上方命令"))
            }
          >
            <Copy />
            {copied ? "已复制" : "复制命令"}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void refreshTaskBoard()}>
            重试
          </Button>
          {mutationError ? (
            <p role="alert" className="mt-2 text-destructive">
              {mutationError}
            </p>
          ) : null}
        </div>
      ) : loading || !data ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          正在读取任务…
        </p>
      ) : (
        <>
          <header className="px-3.5 pt-3.5 pb-1">
            {view === "waiting" ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight">待我处理</h2>
                <span className="text-xs text-muted-foreground">只列现在需要你回复的事</span>
              </div>
            ) : null}
            <div
              role="group"
              aria-label="任务视图"
              className={`inline-flex max-w-full gap-0.5 rounded-lg bg-accent p-0.5 ${view === "waiting" ? "mt-2.5" : ""}`}
            >
              {(
                [
                  ["waiting", "待办"],
                  ["current", "本会话"],
                  ["all", `全部项目 ${allTasks.length}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={view === id}
                  aria-describedby={
                    id === "current" && !current ? "task-board-no-current" : undefined
                  }
                  onClick={() => choose(id)}
                  className={`min-w-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-40 ${view === id ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!current && view === "current" ? (
              <p id="task-board-no-current" className="mt-1 text-3xs text-muted-foreground">
                这个会话还没关联任务
              </p>
            ) : null}
          </header>
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-both pb-2">
            {mutationError ? (
              <p role="alert" className="break-words px-3.5 py-2 text-xs text-destructive">
                {mutationError}
              </p>
            ) : null}
            {view === "waiting" ? (
              <TaskInbox threadRef={threadRef} />
            ) : view === "current" && !current ? (
              <div className="space-y-2 p-3.5">
                <p>这个会话还没关联任务</p>
                {attention.map((task) => (
                  <Button
                    key={task.folder}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void linkSession(
                        task,
                        threadRef.threadId,
                        threads.find((t) => t.id === threadRef.threadId)?.title ?? "当前会话",
                      )
                    }
                  >
                    {task.title}
                  </Button>
                ))}
              </div>
            ) : view === "current" && current ? (
              <>
                <div className="mb-2.5 border-b px-3.5 pt-3 pb-2.5">
                  <p className="break-all text-3xs text-muted-foreground">
                    {current.type_label ? `${current.type_label} · ` : ""}
                    {current.folder}
                  </p>
                  <h2 className="mt-1 text-base font-semibold">{current.title}</h2>
                  <div className="mt-3">
                    <TaskProgress task={current} />
                  </div>
                </div>
                {card(current, true)}
                <div className="px-3.5 pt-1 pb-3">
                  <TaskSteps task={current} />
                </div>
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => openEvidence(current, "HANDOFF.md")}
                  >
                    <FileText />
                    HANDOFF
                  </Button>
                  {links(current, "关联会话")}
                </div>
              </>
            ) : (
              <>
                {["user", "blocked", "agent"].map((group) => {
                  const list = allTasks.filter((task) =>
                    group === "user" ? task.state === "user" : boardTaskGroup(task) === group,
                  );
                  const Icon =
                    group === "judge" || group === "user"
                      ? Eye
                      : group === "do"
                        ? Hand
                        : group === "blocked"
                          ? LockKeyhole
                          : Bot;
                  const label =
                    group === "judge"
                      ? "要你判断"
                      : group === "do"
                        ? "要你动手"
                        : group === "blocked"
                          ? "卡住了"
                          : group === "user"
                            ? "等你"
                            : "Agent 在做";
                  return list.length ? (
                    <section key={group}>
                      <h3 className="flex items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-3xs font-semibold text-muted-foreground">
                        <Icon className="size-3" />
                        {label} · {list.length}
                      </h3>
                      {list.map((task) => card(task, false, task.folder === firstAttention))}
                    </section>
                  ) : null;
                })}
                {view === "all" ? (
                  <section>
                    <button
                      type="button"
                      aria-expanded={completedOpen}
                      className="flex w-full items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-3xs text-muted-foreground"
                      onClick={() => setCompletedOpen(!completedOpen)}
                    >
                      {completedOpen ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      本周完成 · {complete.length}
                    </button>
                    {completedOpen ? complete.map((task) => card(task)) : null}
                  </section>
                ) : null}
              </>
            )}
          </div>
          <footer className="flex flex-wrap justify-between gap-1 border-t px-3.5 py-2 text-3xs text-muted-foreground">
            {approvals !== null ? <span>今天你放行了 {approvals} 步</span> : <span />}
            <span>23:00–9:00 不弹提醒</span>
          </footer>
        </>
      )}
    </section>
  );
}
