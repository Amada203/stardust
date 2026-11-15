import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import { useNowMinute } from "../../hooks/useNowMinute";
import { type BoardTask } from "../../taskBoard.logic";
import {
  boardResumeReason,
  boardResumeToken,
  linkedBoardThread,
  threadResumeToken,
  resumeRequestHidden,
} from "../../resumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { InboxProgress } from "./InboxProgress";
import { useTaskBoard, type InboxThreadRequest } from "../../taskBoard";
import { useAtomValue } from "@effect/atom-react";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../../keybindings";
import { isTerminalFocused } from "../../lib/terminalFocus";
import { isEditableFocused } from "../../lib/editableFocus";
import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { isModelPickerOpen } from "../../modelPickerVisibility";
import { sidebarProviderLabel } from "../../sidebarProviderGrouping";
import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, XIcon } from "lucide-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { SidebarThreadSummary } from "../../types";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { useAllEnvironmentShellsBootstrapped } from "../../state/entities";
import { useEnvironments } from "../../state/environments";
import { useUiStateStore } from "../../uiStateStore";
import {
  inboxReason,
  inboxThreadKey,
  resumableThreads,
  resumeVisits,
  shouldShowInboxRow,
} from "../../workbenchInbox";
import { useWorkbenchInboxStore } from "../../workbenchInboxStore";
import {
  nextAttentionThread,
  attentionThreadLabel,
  attentionPage,
  attentionTimestamp,
  sortedAttentionThreads,
  sidebarRelativeTime,
} from "../../sidebarInboxPresentation";
import { useInboxCountBounce, useInboxExitRows } from "~/lib/workbenchMotion";
import { ActiveWorkOverview } from "./ActiveWorkOverview";
import { onOpenRecentWork } from "../../workbenchNavigation";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { Button } from "../ui/button";
import { Dialog, DialogPopup, DialogTitle, DialogClose } from "../ui/dialog";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";

// Read the clock only from event handlers and the committed-navigation effect.
const visitTimestamp = () => new Date().toISOString();

export function WorkbenchInbox({
  threads,
  projects,
  activeKey,
  navigate,
}: {
  threads: readonly SidebarThreadSummary[];
  projects: readonly SidebarProjectSnapshot[];
  activeKey: string | null;
  navigate: (ref: ScopedThreadRef) => void;
}) {
  const boardTasks = useTaskBoard((s) => (s.error ? null : s.data));
  const hidden = useResumeCardStore((state) => state.hidden);
  const hiddenUntil = useResumeCardStore((state) => state.hiddenUntil);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const boardAttention =
    boardTasks?.tasks.filter(
      (task) =>
        !task.snoozed &&
        (task.state === "user" || task.state === "blocked") &&
        linkedBoardThread(task, threads) !== null &&
        !resumeRequestHidden(
          `board:${task.folder}`,
          boardResumeToken(task),
          hidden,
          hiddenUntil,
          now,
        ),
    ) ?? [];
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const nextShortcut = shortcutLabelForCommand(keybindings, "inbox.next");
  const [view, setView] = useState<"resume" | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to the command that opens the recent-work dialog.
  useEffect(() => onOpenRecentWork(() => setView("resume")), []);
  const visitThread = useAtomCommand(threadEnvironment.visit, { reportFailure: false });
  const [storageError, setStorageError] = useState(false);
  const { saved, visits, acknowledgedErrors, update } = useWorkbenchInboxStore();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const { environments, isReady } = useEnvironments();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const incomplete =
    !bootstrapped ||
    !isReady ||
    environments.length === 0 ||
    environments.some((environment) => environment.connection.phase !== "connected");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Persist the visit only after navigation commits to the active thread.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Display a failed persistence write without recording visits during render.
    if (activeKey) setStorageError(!update("visits", activeKey, visitTimestamp()));
  }, [activeKey, update]);
  const projectByThread = (() => {
    const result = new Map<string, SidebarProjectSnapshot>();
    for (const project of projects)
      for (const key of project.providerThreadKeys ?? []) result.set(key, project);
    return result;
  })();
  const reasons = (() =>
    new Map(
      threads.map((thread) => [
        inboxThreadKey(thread),
        inboxReason(thread, localVisits[inboxThreadKey(thread)]),
      ]),
    ))();
  const attention = sortedAttentionThreads(threads, acknowledgedErrors, localVisits).filter(
    (thread) =>
      !effectiveSnoozed(thread, { now: `${nowMinute}:00Z` }) &&
      !resumeRequestHidden(
        inboxThreadKey(thread),
        threadResumeToken(thread, reasons.get(inboxThreadKey(thread)) ?? "有新结果"),
        hidden,
        hiddenUntil,
        now,
      ),
  );
  const openThread = (thread: SidebarThreadSummary) => {
    const reason = reasons.get(inboxThreadKey(thread)) ?? "有新结果";
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    useResumeCardStore.getState().open({
      key: inboxThreadKey(thread),
      token: threadResumeToken(thread, reason),
      ref,
      title: thread.title,
      reason,
    });
    navigate(ref);
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the inbox keyboard shortcut listener in sync with current actionable threads.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen() || isModelPickerOpen())
        return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          editableFocus: isEditableFocused(event.target),
        },
      });
      if (command !== "inbox.next") return;
      const target = nextAttentionThread(attention, activeKey);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const reason = reasons.get(inboxThreadKey(target)) ?? "有新结果";
      const ref = scopeThreadRef(target.environmentId, target.id);
      useResumeCardStore.getState().open({
        key: inboxThreadKey(target),
        token: threadResumeToken(target, reason),
        ref,
        title: target.title,
        reason,
      });
      navigate(ref);
    };
    // Handle inbox navigation before rich-text keymaps consume shifted Mod-I.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [attention, activeKey, keybindings, navigate, reasons]);
  // Same rule as the right-panel "待回复" tab: things that need an answer, not unread results.
  const requestCount =
    attention.filter((thread) => reasons.get(inboxThreadKey(thread)) !== "有新结果").length +
    boardAttention.length;
  const badgeRef = useInboxCountBounce(requestCount);
  const requests: InboxThreadRequest[] = attention.map((thread) => {
    const key = inboxThreadKey(thread);
    const reason = reasons.get(key) ?? "有新结果";
    const project = projectByThread.get(key);
    const label = attentionThreadLabel(thread, threads, reason);
    return {
      key,
      ref: scopeThreadRef(thread.environmentId, thread.id),
      title: label.title,
      reason,
      place:
        label.detail ??
        `${project?.displayName ?? "项目"} · ${project?.providerLabel ?? sidebarProviderLabel(thread.modelSelection.instanceId)}`,
      dismissLabel: reason === "运行失败" ? "已知悉" : reason === "有新结果" ? "已看" : null,
      dismiss:
        reason === "运行失败"
          ? () => change("acknowledgedErrors", thread, thread.latestRun?.runId ?? null)
          : reason === "有新结果"
            ? () => void markSeen(thread)
            : null,
    };
  });
  const requestSignature = JSON.stringify(
    requests.map((request) => [request.key, request.reason, request.title, request.place]),
  );
  const publishedSignature = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish conversation requests to the right-panel inbox whenever their visible content changes.
  useEffect(() => {
    if (publishedSignature.current === requestSignature) return;
    publishedSignature.current = requestSignature;
    useTaskBoard.setState({ threadRequests: requests });
  });
  const markSeen = async (thread: SidebarThreadSummary) => {
    const visitedAt = visitTimestamp();
    const result = await visitThread({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, visitedAt },
    });
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) setStorageError(true);
      return;
    }
    useUiStateStore.getState().markThreadVisited(inboxThreadKey(thread), visitedAt);
    setStorageError(!update("visits", inboxThreadKey(thread), visitedAt));
  };
  const visitHistory = (() => resumeVisits(threads, localVisits, visits))();
  const recent = (() => resumableThreads(threads, visitHistory, saved))();
  const current = threads.find((thread) => inboxThreadKey(thread) === activeKey);
  const change = (
    field: "saved" | "acknowledgedErrors",
    thread: SidebarThreadSummary,
    value: string | null,
  ) => setStorageError(!update(field, inboxThreadKey(thread), value));
  const renderRows = (items: readonly SidebarThreadSummary[]) =>
    items.map((thread) => {
      const key = inboxThreadKey(thread);
      const project = projectByThread.get(key);
      const isSaved = Boolean(saved[key]);
      return (
        <li key={key} className="flex items-start gap-1 rounded-md p-1 hover:bg-accent/50">
          <button
            type="button"
            className="min-w-0 flex-1 rounded-md p-1 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => {
              navigate(scopeThreadRef(thread.environmentId, thread.id));
              setView(null);
            }}
          >
            <span className="block break-words text-sm font-medium">
              {thread.title || "未命名会话"}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {project?.displayName ?? "项目"} ·{" "}
              {project?.providerLabel ?? thread.modelSelection.instanceId}
              {thread.lineage.relationshipToParent === "subagent" ? " · 子任务" : ""}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {isSaved ? "留待继续" : "最近访问"} ·{" "}
              {sidebarRelativeTime(visitHistory[key] ?? saved[key] ?? thread.updatedAt)}
            </span>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button
              size="icon"
              variant={isSaved ? "secondary" : "ghost"}
              aria-label={isSaved ? "取消留待继续" : "留待继续"}
              aria-pressed={isSaved}
              title={isSaved ? "取消留待继续" : "留待继续"}
              onClick={() => change("saved", thread, isSaved ? null : visitTimestamp())}
            >
              <BookmarkIcon />
            </Button>
          </div>
        </li>
      );
    });
  const section = (title: string, items: readonly SidebarThreadSummary[], empty: string) => (
    <section className="space-y-1">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">{items.length}</span>
      </h3>
      {items.length ? (
        <ul className="space-y-1">{renderRows(items)}</ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  );
  const panel = (
    <DialogPopup showCloseButton={false}>
      <div className="p-4">
        <div className="mb-3 border-b px-1 pb-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>最近访问与留待继续</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="关闭面板" />}>
              <XIcon />
            </DialogClose>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">找回最近访问或留待继续的会话。</p>
        </div>
        <div className="max-h-[min(65vh,640px)] space-y-4 overflow-y-auto px-1 pb-2">
          {incomplete ? (
            <p role="status" className="rounded-md border p-3 text-sm">
              部分连接尚未就绪，以下可能是上次同步的记录；数量不代表全部。
            </p>
          ) : null}
          {storageError ? (
            <p role="alert" className="text-sm text-destructive">
              本机记录保存失败，请检查浏览器存储空间后重试。
            </p>
          ) : null}

          <>
            {current ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  change("saved", current, saved[inboxThreadKey(current)] ? null : visitTimestamp())
                }
              >
                {saved[inboxThreadKey(current)] ? "取消当前会话的留存" : "把当前会话留待继续"}
              </Button>
            ) : null}
            {section(
              "留待继续",
              recent.filter((thread) => saved[inboxThreadKey(thread)]),
              "用书签保留暂时放下的任务，可随时取消。",
            )}
            {section(
              "最近访问",
              recent.filter((thread) => !saved[inboxThreadKey(thread)]).slice(0, 20),
              "打开会话后会记录在这里。",
            )}
            <p className="text-xs text-muted-foreground">
              留存和访问记录保存在本机，不会改变任务完成状态。
            </p>
          </>
        </div>
      </div>
    </DialogPopup>
  );
  const openBoardTask = (task: BoardTask) => {
    const thread = linkedBoardThread(task, threads);
    if (!thread) return;
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    useResumeCardStore.getState().open({
      key: `board:${task.folder}`,
      token: boardResumeToken(task),
      ref,
      title: task.title,
      reason: boardResumeReason(task),
      boardFolder: task.folder,
    });
    navigate(ref);
  };
  const threadRows = attention.map((thread) => {
    const key = inboxThreadKey(thread);
    const reason = reasons.get(key) ?? "有新结果";
    const label = attentionThreadLabel(thread, threads, reason);
    return {
      key,
      thread,
      boardTask: null as BoardTask | null,
      reason,
      label,
      timestamp: attentionTimestamp(thread),
      detail: label.detail,
    };
  });
  const boardRows = boardAttention.map((task) => ({
    key: `board:${task.folder}`,
    thread: linkedBoardThread(task, threads),
    boardTask: task,
    reason: boardResumeReason(task),
    label: { title: task.title },
    timestamp: task.state_since ?? "",
    detail: task.judge?.trim() || task.blocked?.trim() || task.next?.trim() || null,
  }));
  const allRows = [...threadRows, ...boardRows];
  const page = attentionPage(allRows, showAllAttention);
  const rows = page.rows.map((row, index) => ({ ...row, index }));
  const allKeys = new Set(allRows.map((row) => row.key));
  const exiting = useInboxExitRows(rows, allKeys);
  const displayedRows = [...rows];
  for (const row of exiting) displayedRows.splice(row.index, 0, row);
  return (
    <>
      <ActiveWorkOverview
        threads={threads}
        projects={projects}
        activeKey={activeKey}
        navigate={navigate}
        incomplete={incomplete}
      />
      <SidebarMenu>
        {/* Nothing counted and nothing listed: the row stays out of the way. */}
        {exiting.length > 0 ||
        shouldShowInboxRow(requestCount, attention.length + boardAttention.length) ? (
          <SidebarMenuItem>
            <div
              className="group/inbox-cap flex items-center gap-1.5 px-2 pt-2 pb-1 text-2xs tracking-wider text-sidebar-muted-foreground"
              data-sidebar-cap=""
            >
              <span>待我处理</span>
              {nextShortcut && attention.length > 0 ? (
                <span className="tracking-normal opacity-0 transition-opacity group-hover/inbox-cap:opacity-70 motion-reduce:transition-none">
                  下一条 {nextShortcut}
                </span>
              ) : null}
              <span
                ref={badgeRef}
                aria-label={`需要回答 ${requestCount} 条`}
                className={`ml-auto min-w-5 rounded-full px-1.5 text-center font-semibold tracking-normal tabular-nums ${requestCount ? "bg-warning text-background" : ""}`}
              >
                {requestCount}
              </span>
            </div>
            {displayedRows.length > 0 ? (
              <ul aria-label="待我处理的会话" className="space-y-px">
                {displayedRows.map(
                  ({ key, thread, boardTask, reason, label, detail, timestamp }) => {
                    const failed = reason === "运行失败";
                    const leaving = !allKeys.has(key);
                    return (
                      <li
                        key={key}
                        inert={leaving}
                        aria-hidden={leaving || undefined}
                        className={leaving ? "workbench-inbox-exit" : undefined}
                      >
                        <button
                          type="button"
                          data-inbox-thread={thread?.id}
                          data-inbox-task={boardTask?.folder}
                          onClick={() => {
                            if (boardTask) openBoardTask(boardTask);
                            else if (thread) openThread(thread);
                          }}
                          aria-current={activeKey === key ? "page" : undefined}
                          className="relative block w-full min-w-0 rounded-lg py-1.5 pr-2 pl-5.5 text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-sidebar-row-active"
                        >
                          <span
                            aria-hidden
                            className={`absolute top-3.25 left-2.25 size-1.5 rounded-full ${failed ? "bg-destructive" : "bg-warning"}`}
                          />
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">
                              {label.title}
                            </span>
                            <span className="shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground">
                              {sidebarRelativeTime(timestamp)}
                            </span>
                          </span>
                          {thread ? (
                            <InboxProgress
                              thread={thread}
                              board={boardTask}
                              reason={reason}
                              detail={detail}
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  },
                )}
                {allRows.length > page.rows.length || showAllAttention ? (
                  <li>
                    <button
                      type="button"
                      aria-expanded={showAllAttention}
                      onClick={() => setShowAllAttention(!showAllAttention)}
                      className="w-full rounded-lg py-1 pr-2 pl-5.5 text-left text-xs text-sidebar-muted-foreground outline-none hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {showAllAttention ? "收起" : `更多 ${page.hidden}`}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {storageError ? (
              <p role="alert" className="px-2 py-1 text-xs text-destructive">
                本机记录保存失败，请检查浏览器存储空间后重试。
              </p>
            ) : null}
          </SidebarMenuItem>
        ) : null}
        <SidebarMenuItem>
          <Dialog open={view === "resume"} onOpenChange={(open) => setView(open ? "resume" : null)}>
            {panel}
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
