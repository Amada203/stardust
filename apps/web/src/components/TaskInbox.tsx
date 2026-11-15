import { useState } from "react";
import { useNowMinute } from "../hooks/useNowMinute";
import { useNavigate } from "@tanstack/react-router";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Check, ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2 } from "lucide-react";
import { focusTaskBoardItem, mutateTaskBoard, useTaskBoard } from "../taskBoard";
import {
  boardCurrentStep,
  boardEvidenceTarget,
  boardTaskKind,
  boardWaitDays,
  matchBoardTask,
  sortBoardTasks,
  type BoardTask,
} from "../taskBoard.logic";
import { useRightPanelStore } from "../rightPanelStore";
import { useProjects, useThreadShells } from "../state/entities";
import { shellEnvironment } from "../state/shell";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { useAssetUrlState } from "../assets/assetUrls";
import { newMessageId } from "~/lib/utils";
import { openExpandedImagePreview } from "./chat/ExpandedImageDialog";
import { TaskBoardSnooze } from "./TaskBoardPanel";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";

type Shell = ReturnType<typeof useThreadShells>[number];
// Read the clock only from event handlers.
const nowIso = () => new Date().toISOString();
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;
const VIDEO = /\.(mp4|mov|webm|m4v)$/i;

/** One plain sentence: what is being asked of the user, never the project's internal state. */
export function inboxRequestText(task: BoardTask): string {
  const step = boardCurrentStep(task);
  const ask = task.judge?.trim();
  if (ask) return ask;
  const kind = boardTaskKind(task);
  if (kind === "unlock" || kind === "blocked")
    return task.blocked?.trim() ? `需要你处理：${task.blocked.trim()}` : "需要你处理一件卡住的事";
  if (!step) return "看一下这个项目";
  if (kind === "review") return `看看「${step.name}」可不可以`;
  if (kind === "decide") return `「${step.name}」需要你决定`;
  return `「${step.name}」需要你来做`;
}
export function inboxNeedsUser(task: BoardTask) {
  return task.state === "user" || task.state === "blocked";
}

function EvidencePreview({
  environmentId,
  threadId,
  path,
  name,
  routeThreadKey,
}: {
  environmentId: EnvironmentId;
  threadId: ScopedThreadRef["threadId"];
  path: string;
  name: string;
  routeThreadKey: string;
}) {
  const video = VIDEO.test(path);
  const resource = { _tag: "media-file" as const, threadId, path };
  const asset = useAssetUrlState(environmentId, resource);
  const src = asset._tag === "Success" ? asset.url : null;
  const expand = () => {
    if (!src) return;
    openExpandedImagePreview(routeThreadKey, {
      index: 0,
      images: [
        {
          src,
          name,
          ...(video ? { type: "video" as const, autoPlay: true } : {}),
          actionsSource: {
            kind: video ? "video" : "image",
            name,
            src,
            asset: { environmentId, resource },
          },
        },
      ],
    });
  };
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-label={`全屏查看 ${name}`}
        onClick={expand}
        disabled={!src}
        className="relative block aspect-video w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-wait"
      >
        {src ? (
          video ? (
            <video src={src} muted preload="metadata" className="size-full object-contain" />
          ) : (
            <img src={src} alt={name} className="size-full object-contain" />
          )
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted-foreground">
            {asset._tag === "Failure" ? "预览打不开，可在项目文件夹里查看" : "正在载入预览…"}
          </span>
        )}
      </button>
      <Button
        size="sm"
        variant="outline"
        className="mt-1.5 w-full"
        disabled={!src}
        onClick={expand}
      >
        <Maximize2 />
        {video ? "全屏看视频" : "全屏看图"}
      </Button>
      <p className="mt-1 truncate text-3xs text-muted-foreground">{name}</p>
    </div>
  );
}

export function TaskInbox({ threadRef }: { threadRef: ScopedThreadRef }) {
  const { data, focus, threadRequests } = useTaskBoard();
  const [tab, setTab] = useState<"reply" | "later">("reply");
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const threads = useThreadShells();
  const projects = useProjects();
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const startTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}Z`);
  const tasks = sortBoardTasks(data?.tasks ?? []).filter(inboxNeedsUser);
  const replyTasks = tasks.filter((task) => !task.snoozed);
  const laterTasks = tasks.filter((task) => task.snoozed);
  const selected = focus ? (tasks.find((task) => task.folder === focus.folder) ?? null) : null;
  const routeThreadKey = scopedThreadKey(threadRef);

  const linkedThreads = (task: BoardTask): Shell[] =>
    threads
      .filter(
        (thread) =>
          task.sessions.includes(thread.id) ||
          matchBoardTask(
            [task],
            thread.worktreePath ??
              projects.find(
                (p) => p.id === thread.projectId && p.environmentId === thread.environmentId,
              )?.workspaceRoot,
          ) !== null,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const goTo = (ref: ScopedThreadRef) => {
    useRightPanelStore.getState().open(ref, "tasks");
    void navigate({ to: "/$environmentId/$threadId", params: ref });
  };
  const select = (task: BoardTask) => {
    setWriting(false);
    setText("");
    setError(null);
    const source = linkedThreads(task)[0];
    const elsewhere = source && source.id !== threadRef.threadId;
    focusTaskBoardItem(task.folder, elsewhere ? threadRef : (focus?.returnTo ?? null));
    // Answering happens beside the conversation that asked, so the chat follows the item.
    if (elsewhere) goTo(scopeThreadRef(source.environmentId, source.id));
  };
  const back = () => {
    setWriting(false);
    setText("");
    setError(null);
    focusTaskBoardItem(null);
  };
  const openProjectFolder = async (task: BoardTask) => {
    const result = await openInEditor({
      environmentId: threadRef.environmentId,
      input: { cwd: task.folder, editor: "file-manager" },
    });
    if (result._tag === "Failure") setError(`无法打开项目文件夹：${task.folder}`);
  };
  const send = async (thread: Shell, message: string) => {
    const result = await startTurn({
      environmentId: thread.environmentId,
      input: {
        threadId: thread.id,
        message: { messageId: newMessageId(), role: "user", text: message, attachments: [] },
        modelSelection: thread.modelSelection,
        runtimeMode: thread.runtimeMode,
        interactionMode: thread.interactionMode,
        // A busy conversation gets the reply after its current run instead of an interruption.
        dispatchMode: "queue",
        createdAt: nowIso(),
      },
    });
    return result._tag === "Success";
  };
  const answer = async (
    task: BoardTask,
    action: "approve" | "reject" | "toggle" | "note",
    reply: string,
  ) => {
    const step = boardCurrentStep(task);
    const thread = linkedThreads(task)[0] ?? null;
    if (pending) return;
    if (action === "reject" && !reply.trim()) {
      setError("写一句哪里要改，Agent 才知道怎么改。");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (action === "approve" || action === "reject") {
        if (!step) throw new Error("这个任务没有待确认的步骤，请刷新后再试");
        await mutateTaskBoard("review", {
          folder: task.folder,
          step: step.id,
          decision: action,
          ...(action === "reject" ? { reason: reply.trim() } : {}),
        });
      } else if (action === "toggle") {
        if (!step) throw new Error("这个任务没有待完成的步骤，请刷新后再试");
        await mutateTaskBoard("toggle", { folder: task.folder, step: step.id });
      }
      const label = `【${task.title}${step ? ` · ${step.name}` : ""}】`;
      const message =
        action === "approve"
          ? `${label}这版可以，继续。${reply.trim() ? `\n补充：${reply.trim()}` : ""}`
          : action === "reject"
            ? `${label}需要修改：\n${reply.trim()}`
            : action === "toggle"
              ? `${label}我这边做完了。${reply.trim() ? `\n补充：${reply.trim()}` : ""}`
              : `${label}${reply.trim() || "我已经处理好了，请继续。"}`;
      if (thread) {
        const delivered = await send(thread, message);
        toastManager.add(
          delivered
            ? {
                type: "success",
                title: `已发给「${thread.title}」`,
                description: "Agent 会接着做。",
              }
            : {
                type: "warning",
                title: action === "note" ? "没有发出去" : "已记下，但消息没有发出去",
                description: "请打开会话手动告诉 Agent。",
              },
        );
        if (!delivered && action === "note") return;
      } else {
        toastManager.add({
          type: action === "note" ? "warning" : "success",
          title: action === "note" ? "这个项目还没关联会话" : "已记在任务里",
          description:
            action === "note" ? "先打开项目文件夹处理；处理完再标记。" : "这个项目还没关联会话。",
        });
        if (action === "note") {
          void openProjectFolder(task);
          return;
        }
      }
      back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  if (selected) {
    const step = boardCurrentStep(selected);
    const kind = boardTaskKind(selected);
    const linked = linkedThreads(selected);
    const source = linked[0] ?? null;
    const returnThread = focus?.returnTo
      ? threads.find(
          (thread) =>
            thread.id === focus.returnTo!.threadId &&
            thread.environmentId === focus.returnTo!.environmentId,
        )
      : undefined;
    const evidence = (step?.evidence ?? []).map((item) => ({
      item,
      target: boardEvidenceTarget(selected.folder, item),
    }));
    const days = boardWaitDays(selected, now);
    const unlock = kind === "unlock" || kind === "blocked";
    return (
      <div className="px-3.5 pb-4">
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-0.5 rounded-md py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            返回待办
          </button>
          {returnThread && returnThread.id !== threadRef.threadId ? (
            <button
              type="button"
              onClick={() => {
                back();
                goTo(scopeThreadRef(returnThread.environmentId, returnThread.id));
              }}
              className="min-w-0 truncate rounded-md py-1 text-xs text-primary hover:underline"
            >
              回到「{returnThread.title}」
            </button>
          ) : null}
        </div>
        <h2 className="mt-2 break-words text-base leading-snug font-semibold">
          {inboxRequestText(selected)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {selected.title}
          {days ? ` · 等了 ${days} 天` : ""}
        </p>
        {evidence.map(({ item, target }) =>
          target?.kind === "file" && (IMAGE.test(item) || VIDEO.test(item)) ? (
            <EvidencePreview
              key={item}
              environmentId={(source ?? threadRef).environmentId}
              threadId={source?.id ?? threadRef.threadId}
              path={target.value}
              name={item.split("/").at(-1) || item}
              routeThreadKey={routeThreadKey}
            />
          ) : target ? (
            <Button
              key={item}
              size="sm"
              variant="outline"
              className="mt-2 w-full justify-start"
              onClick={() =>
                target.kind === "url"
                  ? window.open(target.value, "_blank", "noopener")
                  : useRightPanelStore.getState().openFile(threadRef, target.value)
              }
            >
              <FileText />
              <span className="truncate">{item.split("/").at(-1) || item}</span>
            </Button>
          ) : null,
        )}
        {selected.next ? (
          <p className="mt-3 rounded-md bg-muted px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
            现在的情况：{selected.next}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {writing || kind === "decide" ? (
            <textarea
              aria-label={kind === "review" ? "修改意见" : "给 Agent 的话"}
              placeholder={
                kind === "review"
                  ? "例如：开头太慢，前 10 秒缩短一点。"
                  : kind === "decide"
                    ? "写下你的决定（会发给 Agent，可不填）"
                    : "补充一句（会发给 Agent，可不填）"
              }
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="block h-20 w-full resize-none rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
          ) : null}
          {unlock ? (
            <>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() =>
                  source
                    ? goTo(scopeThreadRef(source.environmentId, source.id))
                    : void openProjectFolder(selected)
                }
              >
                <ExternalLink />
                {source ? "去会话处理" : "打开项目文件夹"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => void answer(selected, "note", text)}
              >
                我处理好了，告诉 Agent
              </Button>
            </>
          ) : kind === "review" ? (
            writing ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={pending || !text.trim()}
                  onClick={() => void answer(selected, "reject", text)}
                >
                  发送修改意见
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => setWriting(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={() => void answer(selected, "approve", "")}
                >
                  <Check />
                  这版可以，继续
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setWriting(true)}
                >
                  说说哪里要改
                </Button>
              </>
            )
          ) : kind === "decide" ? (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => void answer(selected, "approve", text)}
            >
              <Check />
              我决定了
            </Button>
          ) : (
            <>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => void answer(selected, "toggle", text)}
              >
                <Check />
                我做完了
              </Button>
              {!writing ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setWriting(true)}
                >
                  补充一句
                </Button>
              ) : null}
            </>
          )}
          <div className="flex justify-end">
            <TaskBoardSnooze task={selected} environmentId={threadRef.environmentId} />
          </div>
        </div>
        <p className="mt-3 text-3xs leading-relaxed text-muted-foreground">
          {source
            ? `回复会作为一条消息发进「${source.title}」，只回答这一件事，不代表整个项目完成。`
            : "这个项目还没关联会话：回复只记在任务里。可在「全部项目」里关联会话。"}
        </p>
      </div>
    );
  }

  const list = tab === "reply" ? replyTasks : laterTasks;
  const requests = tab === "reply" ? threadRequests : [];
  const replyCount =
    replyTasks.length + threadRequests.filter((request) => request.reason !== "有新结果").length;
  return (
    <div className="pb-3">
      <div className="flex items-center gap-4 border-b px-3.5 pt-2 text-xs">
        {(
          [
            ["reply", `待回复 ${replyCount}`],
            ["later", `稍后 ${laterTasks.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 pb-2 ${tab === id ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 && requests.length === 0 ? (
        <div className="px-6 py-10 text-center text-xs text-muted-foreground">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-success/10 text-success-foreground">
            <Check className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {tab === "reply" ? "都处理完了" : "没有推迟的事"}
          </p>
          <p className="mt-1">
            {tab === "reply"
              ? "有新的事需要你时，会出现在这里。"
              : "点「稍后提醒」的事会放在这里。"}
          </p>
        </div>
      ) : null}
      <ul>
        {list.map((task) => {
          const days = boardWaitDays(task, now);
          return (
            <li key={task.folder} className="border-b last:border-b-0">
              <button
                type="button"
                data-task-folder={task.folder}
                onClick={() => select(task)}
                className="flex w-full items-start gap-2 px-3.5 py-3 text-left outline-none hover:bg-accent focus-visible:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm leading-snug font-medium">
                    {inboxRequestText(task)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {task.title}
                    {task.state === "blocked" ? " · 卡住了" : ""}
                    {days ? ` · 等了 ${days} 天` : ""}
                  </span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
        {requests.map((request) => (
          <li key={request.key} className="flex items-start gap-1 border-b last:border-b-0">
            <button
              type="button"
              onClick={() => goTo(request.ref)}
              className="min-w-0 flex-1 px-3.5 py-3 text-left outline-none hover:bg-accent focus-visible:bg-accent"
            >
              <span className="block break-words text-sm leading-snug font-medium">
                {request.reason}：{request.title}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {request.place}
              </span>
            </button>
            {request.dismiss ? (
              <Button
                size="xs"
                variant="ghost"
                className="mt-2.5 mr-2"
                onClick={() => request.dismiss?.()}
              >
                {request.dismissLabel}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
