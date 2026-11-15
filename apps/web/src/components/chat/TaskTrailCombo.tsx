import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  FileSearchIcon,
  FilePenIcon,
  TerminalIcon,
  ImageIcon,
  SearchIcon,
  GitForkIcon,
} from "lucide-react";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { animateWorkbenchOnce } from "../../lib/workbenchMotion";
import { observeVisibleAnimation } from "../../lib/visibleAnimation";
import { cn } from "../../lib/utils";
import { formatStepDuration, taskProgressStateLabels } from "./TaskProgressSteps";
import { primaryTrailTool, type TrailDetails } from "./taskTrailModel";
import { uiText } from "../../i18n";

export interface TaskTrailComboProps {
  progress: TaskProgressSnapshot;
  defaultExpanded?: boolean;
  expansionKey?: string;
  details?: TrailDetails;
  decision?: ReactNode;
  approval?: { requestId: string; summary: string; card: ReactNode };
  approvalResults?: Readonly<Record<string, ReactNode>>;
  onOpenFile?: (path: string) => void;
}
const tools = {
  read: FileSearchIcon,
  write: FilePenIcon,
  command: TerminalIcon,
  image: ImageIcon,
  search: SearchIcon,
  delegate: GitForkIcon,
};
const storageKey = (key: string) => `t3code:task-trail-expanded:v1:${key}`;
function initialExpanded(key: string | undefined, fallback: boolean) {
  try {
    const value = key ? localStorage.getItem(storageKey(key)) : null;
    return value === "true" ? true : value === "false" ? false : fallback;
  } catch {
    return fallback;
  }
}
function rememberExpanded(key: string | undefined, value: boolean) {
  try {
    if (key) localStorage.setItem(storageKey(key), String(value));
  } catch {
    /* Storage can be disabled. */
  }
}
function Mark({ mode, spinning }: { mode: string; spinning: boolean }) {
  return (
    <span className="combo-mark" data-mode={mode} aria-hidden>
      {mode === "done" ? (
        <CheckIcon size={10} strokeWidth={2.5} />
      ) : spinning ? (
        <svg
          ref={observeVisibleAnimation}
          className="motion-safe:visible-animate-spin"
          data-task-trail-spinner=""
          viewBox="0 0 16 16"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeOpacity=".2"
          />
          <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : null}
    </span>
  );
}
function StepRow({
  completed,
  visible,
  children,
}: {
  completed: boolean;
  visible: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const previous = useRef(completed);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Draw only a newly committed completion, never historical checks.
  useLayoutEffect(() => {
    const changed = previous.current !== completed;
    previous.current = completed;
    const path = ref.current?.querySelector(".combo-mark path");
    if (!changed || !completed || !visible || !path) return;
    return animateWorkbenchOnce(
      path,
      [
        { strokeDasharray: "24", strokeDashoffset: "24" },
        { strokeDasharray: "24", strokeDashoffset: "0" },
      ],
      { duration: 350, easing: "ease" },
    );
  }, [completed, visible]);
  return <li ref={ref}>{children}</li>;
}

export function TaskTrailCombo({
  progress,
  defaultExpanded = true,
  expansionKey,
  details,
  decision,
  approval,
  approvalResults,
  onOpenFile,
}: TaskTrailComboProps) {
  const [expanded, setExpanded] = useState(
    () => initialExpanded(expansionKey, approval ? true : defaultExpanded) || Boolean(approval),
  );
  const [previousKey, setPreviousKey] = useState(expansionKey);
  if (previousKey !== expansionKey) {
    setPreviousKey(expansionKey);
    setExpanded(initialExpanded(expansionKey, defaultExpanded));
  }
  const [previousApproval, setPreviousApproval] = useState(approval?.requestId);
  if (previousApproval !== approval?.requestId) {
    setPreviousApproval(approval?.requestId);
    if (approval) setExpanded(true);
  }
  const listId = useId();
  const done =
    progress.total > 0 &&
    progress.completed === progress.total &&
    progress.state === "complete" &&
    !decision &&
    !approval;
  const waiting =
    Boolean(approval) ||
    (!progress.stale && (progress.state === "input" || progress.state === "approval"));
  const live = !progress.stale && progress.state === "running" && !done && !approval;
  const currentIndex = progress.steps.findIndex((step) => step.status === "running");
  const pendingIndex = progress.steps.findIndex((step) => step.status === "pending");
  const activeIndex =
    currentIndex >= 0
      ? currentIndex
      : pendingIndex >= 0
        ? pendingIndex
        : decision || approval || approvalResults
          ? progress.steps.length - 1
          : -1;
  const mode = done ? "done" : waiting ? "need" : live ? "run" : "idle";
  const summary = [
    `${progress.total} 步完成`,
    ...(details?.durationMs !== undefined ? [formatStepDuration(details.durationMs)] : []),
    ...(details?.fileCount !== undefined ? [`产出 ${details.fileCount} 个文件`] : []),
    ...(details?.choices.length ? [`选了 ${details.choices.join("、")}`] : []),
  ].join(" · ");
  const title = approval
    ? `等你批准：${approval.summary}`
    : done
      ? summary
      : (progress.steps[activeIndex]?.text ?? uiText("Task steps"));
  const status = approval
    ? "待授权"
    : progress.stale
      ? uiText("Status may be out of date")
      : done
        ? "已完成"
        : waiting
          ? "等你判断"
          : live
            ? "进行中"
            : uiText(taskProgressStateLabels[progress.state]);
  const titleRef = useRef<HTMLSpanElement>(null);
  const previousTitle = useRef(title);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Animate the changed step title once after DOM commit.
  useLayoutEffect(() => {
    const changed = previousTitle.current !== title;
    previousTitle.current = title;
    if (!changed || !titleRef.current) return;
    return animateWorkbenchOnce(
      titleRef.current,
      [
        { opacity: 0, transform: "translateY(9px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 350, easing: "ease-out" },
    );
  }, [title]);
  const completedPlanKey = done ? (progress.planId ?? "complete") : null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One timeout on completion; cleanup prevents an old run collapsing a new run.
  useEffect(() => {
    if (completedPlanKey === null) return;
    const timer = window.setTimeout(() => {
      setExpanded(false);
      rememberExpanded(expansionKey, false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [completedPlanKey, expansionKey]);
  return (
    <section
      aria-label={uiText("Task progress")}
      className="task-trail combo-trail"
      data-task-trail={progress.state}
      data-mode={mode}
    >
      <button
        type="button"
        className="combo-bar"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => {
          setExpanded(!expanded);
          rememberExpanded(expansionKey, !expanded);
        }}
      >
        <Mark mode={mode} spinning={live && !expanded} />
        <span className="combo-title">
          <span ref={titleRef}>{title}</span>
        </span>
        <span className="combo-pill">{status}</span>
        <span className="combo-segments" aria-hidden>
          {progress.steps.map((step, index) => (
            <i
              key={step.id}
              data-mode={
                index === activeIndex && approval
                  ? "need"
                  : step.status === "completed"
                    ? "done"
                    : index === activeIndex
                      ? mode
                      : "pending"
              }
            />
          ))}
        </span>
        <span className="combo-count">
          {progress.completed}/{progress.total}
        </span>
        <ChevronDownIcon size={13} className={cn("shrink-0", expanded && "rotate-180")} />
      </button>
      <div
        id={listId}
        className="combo-body"
        data-expanded={expanded}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div>
          <ol aria-label={uiText("Reported task steps")} className="combo-list">
            {progress.steps.map((step, index) => {
              const completed = step.status === "completed";
              const current = index === activeIndex && !done;
              const activities = details?.activities[step.id] ?? [];
              const tool = primaryTrailTool(activities);
              const Icon = tool ? tools[tool] : null;
              return (
                <StepRow key={step.id} completed={completed} visible={expanded}>
                  <div className="combo-step" aria-current={current ? "step" : undefined}>
                    <Mark
                      mode={current ? mode : completed ? "done" : "pending"}
                      spinning={current && live && expanded}
                    />
                    {Icon ? (
                      <span className="combo-tool">
                        <Icon size={13} />
                      </span>
                    ) : null}
                    <span className={cn("combo-step-title", current && "font-semibold")}>
                      {step.text}
                    </span>
                    <span className={cn("combo-time", current && waiting && "text-warning")}>
                      {current && waiting
                        ? approval
                          ? "待授权"
                          : "需你判断"
                        : completed && step.durationMs !== undefined
                          ? formatStepDuration(step.durationMs)
                          : current
                            ? status
                            : ""}
                    </span>
                  </div>
                  {activities.length > 0 ? (
                    <div className="combo-activities" data-step-activities={step.id}>
                      {activities.slice(0, 3).map((activity) => (
                        <div key={activity.id} className="combo-activity">
                          <span>{activity.label}</span>
                          {activity.path ? (
                            onOpenFile ? (
                              <button
                                type="button"
                                aria-label={activity.path}
                                onClick={() => onOpenFile(activity.path!)}
                              >
                                {activity.path.split(/[\\/]/).at(-1)}
                              </button>
                            ) : (
                              <span>{activity.path.split(/[\\/]/).at(-1)}</span>
                            )
                          ) : null}
                        </div>
                      ))}
                      {activities.length > 3 ? (
                        <span className="text-muted-foreground">+{activities.length - 3}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {current && approval ? approval.card : current && decision ? decision : null}
                  {approvalResults?.[step.id]}
                </StepRow>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
