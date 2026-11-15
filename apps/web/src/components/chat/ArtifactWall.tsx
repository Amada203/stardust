import type { EnvironmentId, ThreadId, WallArtifact } from "@t3tools/contracts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animateWorkbenchOnce, workbenchEase } from "~/lib/workbenchMotion";
import {
  CheckIcon,
  ChevronLeftIcon,
  FolderOpenIcon,
  PlusIcon,
  ChevronRightIcon,
  FileIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  XIcon,
} from "lucide-react";
import {
  artifactCounts,
  artifactCheckLabel,
  isArtifactVideo,
  artifactVideoDuration,
  groupArtifacts,
  ARTIFACT_DRAG_TYPE,
  artifactRevisionPrompt,
  artifactVersionKey,
} from "../../artifactWall";
import { artifactFileUrl, fileFromArtifact } from "../../lib/artifactWallClient";
import { useWallArtifacts } from "../../useWallArtifacts";
import { artifactsSince } from "../../artifactShelf";
import { useQuietThreadShell } from "../../state/entities";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useAtomCommand } from "../../state/use-atom-command";
import { shellEnvironment } from "../../state/shell";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

export function ArtifactWall({
  environmentId,
  threadId,
  onAttach,
  onRevise,
  revisionEnabled = false,
  active = true,
  onCount,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  onAttach: (files: File[]) => void;
  onRevise?: (prompt: string) => boolean;
  revisionEnabled?: boolean;
  /** An inactive wall keeps loading (for the tab count) but renders nothing, so no thumbnails load. */
  active?: boolean;
  onCount?: (count: number) => void;
}) {
  const [scope, setScope] = useState<"thread" | "project">("thread");
  const [filter, setFilter] = useState<"all" | WallArtifact["kind"]>("all");
  const state = useWallArtifacts(environmentId, threadId, scope);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [visible, setVisible] = useState(40);
  const [selected, setSelected] = useState<WallArtifact | null>(null);
  const [comparison, setComparison] = useState<WallArtifact | null>(null);
  const [compareMode, setCompareMode] = useState<"slider" | "a" | "b">("slider");
  const [split, setSplit] = useState(50);
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const [thumbCount, setThumbCount] = useState(40);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // ⌘/Ctrl-click or the corner check picks up to two images to compare.
  const [picked, setPicked] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [featuredVersion, setFeaturedVersion] = useState<string | null>(null);
  const filmstrip = useRef<HTMLDivElement | null>(null);
  const loadMore = useRef<HTMLDivElement | null>(null);
  const scrollRoot = useRef<HTMLDivElement | null>(null);
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const key = `${environmentId}:${threadId}:${scope}`;
  const artifacts = state.artifacts;
  const arrivalHistory = useRef<{ key: string; ids: Set<string> } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Compare successful collection snapshots and animate only newly committed, visible DOM rows.
  useLayoutEffect(() => {
    if (!active) {
      arrivalHistory.current = null;
      return;
    }
    if (state.loading || state.error) return;
    const before = arrivalHistory.current;
    arrivalHistory.current = { key, ids: new Set(artifacts.map((artifact) => artifact.id)) };
    if (!before || before.key !== key) return;
    const stops: (() => void)[] = [];
    for (const row of scrollRoot.current?.querySelectorAll<HTMLElement>("[data-artifact-id]") ??
      []) {
      if (before.ids.has(row.dataset.artifactId!)) continue;
      stops.push(
        animateWorkbenchOnce(
          row,
          [
            { opacity: 0, transform: "translateY(-6px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 450, easing: workbenchEase },
        ),
      );
      stops.push(
        animateWorkbenchOnce(row, [{ opacity: 1 }, { opacity: 0 }], {
          duration: 450,
          easing: workbenchEase,
          pseudoElement: "::before",
        }),
      );
    }
    return () => {
      for (const stop of stops) stop();
    };
  }, [active, key, artifacts, state.loading, state.error]);
  const viewKey = `${key}:${filter}`;
  const [previousViewKey, setPreviousViewKey] = useState(viewKey);
  if (previousViewKey !== viewKey) {
    setPreviousViewKey(viewKey);
    setVisible(40);
    setSelected(null);
    setComparison(null);
    setActionError(null);
    setPicked([]);
    setFeaturedVersion(null);
  }
  const filtered = (() => artifacts.filter((a) => filter === "all" || a.kind === filter))();
  const counts = artifactCounts(artifacts);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish the current RPC-backed collection count to the host tab indicator.
  useEffect(() => {
    onCount?.(counts.all);
  }, [counts.all, onCount]);
  const groups = groupArtifacts(filtered.slice(0, visible));
  const images = (() => artifacts.filter((a) => a.kind === "image"))();
  const newestImage =
    filter === "all" || filter === "image"
      ? (images.toSorted((a, b) =>
          (b.modifiedAt ?? b.createdAt).localeCompare(a.modifiedAt ?? a.createdAt),
        )[0] ?? null)
      : null;
  // Versions only when the listing really holds several files at the same path.
  const featuredVersions = newestImage
    ? images
        .filter((a) => a.path === newestImage.path)
        .toSorted((a, b) =>
          (a.modifiedAt ?? a.createdAt).localeCompare(b.modifiedAt ?? b.createdAt),
        )
    : [];
  const featured =
    featuredVersions.find((a) => artifactVersionKey(a) === featuredVersion) ?? newestImage;
  // "新": touched since this thread's latest run began (same rule as the composer shelf).
  const latestRun = useQuietThreadShell(scopeThreadRef(environmentId, threadId))?.latestRun;
  const newArtifactKeys = new Set(
    scope === "thread"
      ? artifactsSince(artifacts, latestRun?.startedAt ?? latestRun?.requestedAt ?? null).map(
          artifactVersionKey,
        )
      : [],
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the browser intersection observer attached to the current pagination sentinel.
  useEffect(() => {
    const element = loadMore.current;
    if (!element || visible >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((n) => n + 40);
      },
      { root: scrollRoot.current, rootMargin: "80px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, filtered.length]);
  const compare = (a: WallArtifact) => {
    setSelected(a);
    setComparison(null);
    setSplit(50);
    setCompareMode("slider");
    setThumbCount(40);
  };
  const togglePick = (a: WallArtifact) =>
    setPicked((current) =>
      current.includes(a.id)
        ? current.filter((id) => id !== a.id)
        : current.length >= 2
          ? [current[1]!, a.id]
          : [...current, a.id],
    );
  const openPickedCompare = () => {
    const [first, second] = picked.map((id) => artifacts.find((a) => a.id === id));
    if (!first || !second) return;
    setSelected(second);
    setComparison(first);
    setSplit(50);
    setCompareMode("slider");
    setThumbCount(40);
    setPicked([]);
  };
  const selectedImageIndex =
    selected && selected.kind === "image"
      ? images.findIndex((a) => artifactVersionKey(a) === artifactVersionKey(selected))
      : -1;
  const stepImage = (delta: number) => {
    if (selectedImageIndex < 0 || images.length < 2) return;
    const index = (selectedImageIndex + delta + images.length) % images.length;
    const next = images[index]!;
    setSelected(next);
    if (comparison && artifactVersionKey(comparison) === artifactVersionKey(next)) {
      setComparison(null);
    }
    setThumbCount((n) => Math.max(n, index + 20));
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Arrow keys page through images while the viewer is open.
  useEffect(() => {
    if (selectedImageIndex < 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        stepImage(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    // Capture phase: the dialog's own key handling must not swallow paging.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the current image centered in the filmstrip.
  useEffect(() => {
    if (!selected) return;
    const strip = filmstrip.current;
    const item = strip?.querySelector<HTMLElement>(
      `[data-film-key="${CSS.escape(artifactVersionKey(selected))}"]`,
    );
    item?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected]);
  const copyPath = async (a: WallArtifact) => {
    try {
      await navigator.clipboard.writeText(a.path);
    } catch {
      setActionError("无法复制路径");
    }
  };
  const revisionKey = selected ? `${key}:${artifactVersionKey(selected)}` : "";
  const revisionNote = revisionNotes[revisionKey] ?? "";
  // Access IDs are renewed on every listing; match the file by its stable version instead.
  const currentSelected = selected
    ? artifacts.find((a) => artifactVersionKey(a) === artifactVersionKey(selected))
    : undefined;
  const selectedIsCurrent = currentSelected !== undefined;
  const requestRevision = () => {
    if (!revisionEnabled || !selected || !selectedIsCurrent || !onRevise || !revisionNote.trim())
      return;
    try {
      if (!onRevise(artifactRevisionPrompt(selected, revisionNote))) {
        setActionError("输入框暂不可用，修改意见已保留，请稍后重试。");
        return;
      }
      setRevisionNotes((notes) => ({ ...notes, [revisionKey]: "" }));
      setSelected(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "无法加入草稿，修改意见已保留。");
    }
  };
  const reveal = async (a: WallArtifact) => {
    const result = await openInEditor({
      environmentId,
      input: { cwd: a.path, editor: "file-manager", reveal: true },
    });
    if (result._tag === "Failure") setActionError("无法在 Finder 中显示此文件");
  };
  const attach = async (a: WallArtifact) => {
    setBusy(true);
    setActionError(null);
    await (async () => {
      try {
        const file = await fileFromArtifact(environmentId, a);
        onAttach([file]);
        setSelected(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "无法附加此文件");
      }
    })().finally(() => {
      setBusy(false);
    });
  };
  const openPage = (a: WallArtifact) =>
    window.open(artifactFileUrl(environmentId, a.id) ?? "", "_blank", "noopener,noreferrer");
  const dragArtifact = (event: React.DragEvent, a: WallArtifact) => {
    event.dataTransfer.setData(ARTIFACT_DRAG_TYPE, JSON.stringify({ environmentId, artifact: a }));
    event.dataTransfer.effectAllowed = "copy";
  };
  // Check status and size are detail: they live in the hover text, not in the layout.
  const artifactTooltip = (a: WallArtifact) => (
    <span className="flex max-w-64 flex-col gap-0.5">
      <span className="break-all">{a.name}</span>
      <span className="text-muted-foreground">
        {a.width && a.height ? `${a.width}×${a.height}` : `${Math.ceil(a.sizeBytes / 1024)} KB`}
        {" · "}
        {artifactCheckLabel(a)}
      </span>
      <span className="text-muted-foreground">
        {a.verification?.label
          ? `${a.verification.label} · ${a.verification.checkedAt ?? ""}。此项为检查命令记录，不代表用户验收或已部署。`
          : "文件存在不代表检查通过。完成检查后，由 Agent 关联相应执行记录。"}
      </span>
    </span>
  );
  const thumb = (a: WallArtifact, className: string) =>
    a.kind === "image" ? (
      <img
        src={artifactFileUrl(environmentId, a.id) ?? undefined}
        alt={a.name}
        loading="lazy"
        decoding="async"
        className={className}
      />
    ) : isArtifactVideo(a) ? (
      <video
        src={`${artifactFileUrl(environmentId, a.id) ?? ""}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        aria-label={`视频缩略图 ${a.name}`}
        className={className}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration))
            setDurations((values) =>
              values[a.id] === duration ? values : { ...values, [a.id]: duration },
            );
        }}
      />
    ) : (
      <div
        className={`${className} flex items-center justify-center bg-muted text-muted-foreground`}
      >
        {a.kind === "page" ? <GlobeIcon className="size-6" /> : <FileIcon className="size-6" />}
      </div>
    );
  if (!active) return null;
  return (
    <section aria-label="产物" className="min-w-0 px-3 pt-2 pb-2" data-artifact-wall>
      <div className="mb-2 flex min-w-0 items-center gap-1">
        <ToggleGroup
          aria-label="产物范围"
          variant="segmented"
          value={[scope]}
          onValueChange={(next) => {
            const value = next[0];
            if (value !== "thread" && value !== "project") return;
            setScope(value);
            setFilter("all");
          }}
        >
          <Toggle value="thread">本会话</Toggle>
          <Toggle value="project">本项目</Toggle>
        </ToggleGroup>
      </div>
      {!(state.error && artifacts.length === 0) && (
        <div className="mb-2 flex flex-nowrap gap-0.5" aria-label="产物类型">
          {(
            [
              ["all", "全部"],
              ["image", "图片"],
              ["video", "视频"],
              ["page", "页面"],
              ["document", "文档"],
            ] as const
          )
            .filter(([value]) => value === "all" || counts[value] > 0)
            .map(([value, label]) => (
              <Button
                size="micro"
                variant={filter === value ? "secondary" : "ghost"}
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} {counts[value]}
              </Button>
            ))}
        </div>
      )}
      {actionError ? (
        <p role="alert" className="mb-2 text-2xs text-destructive">
          {actionError}
        </p>
      ) : null}
      {featured && !state.loading && !state.error ? (
        // The newest image as a preview card above the scrolling list (mockup .pv): 16:10 media, title, meta, versions
        // when the same file has several, then two equal-height actions.
        <div
          className="@container mb-3 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
          data-artifact-featured={featured.id}
        >
          <button
            type="button"
            aria-label={`预览 ${featured.name}`}
            className="block aspect-16/10 w-full cursor-zoom-in overflow-hidden bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => compare(featured)}
          >
            {thumb(featured, "size-full object-cover")}
          </button>
          <div className="px-3 pt-2.5 pb-3">
            <p className="truncate text-sm font-semibold text-foreground">{featured.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {featured.width && featured.height
                ? `${featured.width} × ${featured.height}`
                : `${Math.ceil(featured.sizeBytes / 1024)} KB`}
              {" · "}
              {new Date(featured.modifiedAt ?? featured.createdAt).toLocaleString(undefined, {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {featuredVersions.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-0.75" aria-label="版本">
                {featuredVersions.map((version, index) => {
                  const current = artifactVersionKey(version) === artifactVersionKey(featured);
                  return (
                    <button
                      type="button"
                      key={artifactVersionKey(version)}
                      aria-pressed={current}
                      onClick={() => setFeaturedVersion(artifactVersionKey(version))}
                      className={cn(
                        "h-6.5 min-w-7.5 rounded-md px-1.5 text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                        current
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      v{index + 1}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={busy}
                aria-label={`把 ${featured.name} 附加到输入框`}
                onClick={() => void attach(featured)}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-foreground px-2 text-xs font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
              >
                <PlusIcon aria-hidden className="hidden size-3.5 shrink-0 @2xs:block" />
                <span className="truncate">{busy ? "正在附加…" : "附加到输入框"}</span>
              </button>
              <button
                type="button"
                aria-label={`在 Finder 中显示 ${featured.name}`}
                onClick={() => void reveal(featured)}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-muted px-2 text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <FolderOpenIcon aria-hidden className="hidden size-3.5 shrink-0 @2xs:block" />
                <span className="truncate">在 Finder 中显示</span>
              </button>
            </div>
            <p className="mt-2 text-2xs leading-normal text-muted-foreground">
              {featured.verification?.label
                ? `${featured.verification.label}。此项为检查命令记录，不代表用户验收或已部署。`
                : "文件存在不代表检查通过。完成检查后，由 Agent 关联相应执行记录。"}
            </p>
          </div>
        </div>
      ) : null}
      <div
        ref={scrollRoot}
        className="max-h-[min(52dvh,28rem)] min-w-0 overflow-y-auto overscroll-contain"
        data-artifact-scroll
      >
        {state.loading ? (
          <p className="py-2 text-2xs text-muted-foreground">正在读取产物…</p>
        ) : state.error ? (
          <div className="py-2">
            <p role="alert" className="text-2xs text-muted-foreground">
              {state.error}
            </p>
            <Button size="xs" variant="ghost" onClick={state.retry}>
              重试
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-2 text-2xs text-muted-foreground">
            {artifacts.length
              ? "没有此类产物"
              : scope === "thread"
                ? "这个会话还没有产物"
                : "这个项目还没有产物"}
          </p>
        ) : null}
        {groups.map((group) => (
          // One row per artifact (mockup .alist/.ai): thumbnail or type, name, "新", time.
          <div key={group.label}>
            <p className="px-1 pt-1.5 pb-1 text-2xs tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="flex flex-col" data-artifact-list>
              {group.artifacts.map((a) => {
                const isPicked = picked.includes(a.id);
                const isNew = newArtifactKeys.has(artifactVersionKey(a));
                const open = (event: React.MouseEvent) => {
                  if (a.kind === "image" && (event.metaKey || event.ctrlKey)) {
                    togglePick(a);
                    return;
                  }
                  if (a.kind === "image" || isArtifactVideo(a)) compare(a);
                  else if (a.kind === "page") openPage(a);
                  else void reveal(a);
                };
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "artifact-wall-row group relative flex min-w-0 items-center rounded-lg hover:bg-accent/50 focus-within:bg-accent/50",
                      isPicked && "bg-accent",
                    )}
                    draggable
                    onDragStart={(event) => dragArtifact(event, a)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenuFor(a.id);
                    }}
                    data-artifact-id={a.id}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label={
                              a.kind === "image"
                                ? `查看 ${a.name}`
                                : isArtifactVideo(a)
                                  ? `播放 ${a.name}`
                                  : `打开 ${a.name}`
                            }
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={open}
                          />
                        }
                      >
                        {a.kind === "image" ? (
                          <img
                            src={artifactFileUrl(environmentId, a.id) ?? undefined}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-6 w-9.5 shrink-0 rounded-sm bg-muted object-cover ring-1 ring-border"
                          />
                        ) : (
                          <span className="w-9.5 shrink-0 truncate text-3xs font-semibold tracking-wide text-muted-foreground">
                            {isArtifactVideo(a)
                              ? `▶ ${
                                  durations[a.id] !== undefined
                                    ? artifactVideoDuration(durations[a.id]!)
                                    : a.extension.toUpperCase()
                                }`
                              : a.extension.toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground/85 group-hover:text-foreground">
                          {a.name}
                        </span>
                        {isNew ? (
                          <span className="shrink-0 text-2xs font-semibold text-primary">新</span>
                        ) : null}
                        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground group-hover:invisible group-focus-within:invisible">
                          {new Date(a.modifiedAt ?? a.createdAt).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </TooltipTrigger>
                      <TooltipPopup>{artifactTooltip(a)}</TooltipPopup>
                    </Tooltip>
                    {/* Row tools sit over the time on hover/focus; the layout never shifts. */}
                    <div
                      className={cn(
                        "absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-data-popup-open:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none",
                        isPicked && "opacity-100",
                      )}
                    >
                      {a.kind === "image" ? (
                        <button
                          type="button"
                          aria-label={isPicked ? `取消选择 ${a.name}` : `选择 ${a.name} 用于对比`}
                          aria-pressed={isPicked}
                          onClick={() => togglePick(a)}
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                            isPicked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {isPicked ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
                        </button>
                      ) : null}
                      <Menu
                        open={menuFor === a.id}
                        onOpenChange={(open) => setMenuFor(open ? a.id : null)}
                      >
                        <MenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`更多操作 ${a.name}`}
                              className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-3.5" />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          {a.kind === "page" ? (
                            <MenuItem onClick={() => openPage(a)}>打开</MenuItem>
                          ) : null}
                          <MenuItem onClick={() => void attach(a)}>附加到输入框</MenuItem>
                          <MenuItem onClick={() => void reveal(a)}>在 Finder 中显示</MenuItem>
                          <MenuItem onClick={() => void copyPath(a)}>复制路径</MenuItem>
                          {a.kind === "image" ? (
                            <MenuItem onClick={() => togglePick(a)}>
                              {isPicked ? "取消对比选择" : "选来对比"}
                            </MenuItem>
                          ) : null}
                        </MenuPopup>
                      </Menu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {visible < filtered.length ? (
          <div ref={loadMore} className="py-2">
            <Button size="xs" variant="ghost" onClick={() => setVisible((n) => n + 40)}>
              加载更多
            </Button>
          </div>
        ) : null}
      </div>
      {picked.length > 0 ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-full border border-border bg-background/90 py-1 pr-1 pl-3 text-xs shadow-sm backdrop-blur">
          <span>
            已选 {picked.length} 张{picked.length < 2 ? " · 再选 1 张即可对比" : ""}
          </span>
          <span className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setPicked([])}>
              取消
            </Button>
            <Button size="xs" disabled={picked.length !== 2} onClick={openPickedCompare}>
              对比
            </Button>
          </span>
        </div>
      ) : null}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogPopup
          variant="media"
          showCloseButton={false}
          className="h-[80dvh] w-full max-w-5xl"
          aria-describedby={undefined}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg bg-background p-4 text-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="min-w-0 flex-1">
                <span className="block truncate">{selected?.name}</span>
              </DialogTitle>
              {selectedImageIndex >= 0 && images.length > 1 ? (
                <span className="hidden shrink-0 text-2xs text-muted-foreground sm:inline">
                  ← → 切换 · ⇧ 点胶片对比
                </span>
              ) : null}
              <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
                <XIcon className="size-3" />
                Esc 关闭
              </Button>
            </div>
            {selected && !selectedIsCurrent ? (
              <p role="alert" className="text-xs text-muted-foreground">
                文件已更新或移除。请关闭预览，再打开最新版本。
              </p>
            ) : null}
            {selected ? (
              <>
                {isArtifactVideo(selected) ? (
                  <div
                    className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted"
                    data-artifact-player
                  >
                    <video
                      key={selected.id}
                      src={
                        artifactFileUrl(environmentId, currentSelected?.id ?? selected.id) ??
                        undefined
                      }
                      controls
                      playsInline
                      preload="metadata"
                      className="size-full object-contain"
                      aria-label={`播放 ${selected.name}`}
                    />
                  </div>
                ) : (
                  <div
                    className="group/artifact-compare relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted"
                    data-artifact-compare
                  >
                    {selectedImageIndex >= 0 && images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label="上一张"
                          onClick={() => stepImage(-1)}
                          className="absolute top-1/2 left-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-sm backdrop-blur-md transition hover:bg-background"
                        >
                          <ChevronLeftIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="下一张"
                          onClick={() => stepImage(1)}
                          className="absolute top-1/2 right-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/75 text-foreground shadow-sm backdrop-blur-md transition hover:bg-background"
                        >
                          <ChevronRightIcon className="size-4" />
                        </button>
                        <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-2xs text-white tabular-nums">
                          {selectedImageIndex + 1} / {images.length}
                        </span>
                      </>
                    ) : null}
                    {comparison ? (
                      <img
                        src={artifactFileUrl(environmentId, comparison.id) ?? undefined}
                        alt={comparison.name}
                        className="absolute inset-0 size-full object-contain"
                        style={{
                          clipPath:
                            compareMode === "slider" ? `inset(0 ${100 - split}% 0 0)` : undefined,
                          visibility: compareMode === "b" ? "hidden" : "visible",
                        }}
                      />
                    ) : null}
                    <img
                      key={artifactVersionKey(selected)}
                      src={
                        artifactFileUrl(environmentId, currentSelected?.id ?? selected.id) ??
                        undefined
                      }
                      alt={selected.name}
                      className="artifact-viewer-image absolute inset-0 size-full object-contain"
                      style={
                        comparison
                          ? {
                              clipPath:
                                compareMode === "slider" ? `inset(0 0 0 ${split}%)` : undefined,
                              visibility: compareMode === "a" ? "hidden" : "visible",
                            }
                          : undefined
                      }
                    />
                    {comparison && compareMode === "slider" ? (
                      <>
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 w-px bg-background/95 ring-1 ring-inset ring-border"
                          style={{ left: `${split}%` }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={split}
                          onChange={(e) => setSplit(Number(e.target.value))}
                          aria-label="拖动中线对比"
                          aria-valuetext={`对比图 ${split}%，当前图 ${100 - split}%`}
                          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm backdrop-blur-md group-focus-within/artifact-compare:ring-2 group-focus-within/artifact-compare:ring-inset group-focus-within/artifact-compare:ring-ring"
                          style={{ left: `${split}%`, transform: "translate(-50%, -50%)" }}
                        >
                          <ChevronLeftIcon className="size-3.5" strokeWidth={1.5} />
                          <ChevronRightIcon className="-ml-1 size-3.5" strokeWidth={1.5} />
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
                {comparison ? (
                  <div
                    role="group"
                    aria-label="图片对比方式"
                    className="mx-auto flex shrink-0 items-center gap-0.5 rounded-full bg-secondary p-0.5"
                  >
                    {(
                      [
                        ["single", "单图"],
                        ["slider", "滑动对比"],
                        ["a", "A 全图"],
                        ["b", "B 全图"],
                      ] as const
                    ).map(([mode, label]) => {
                      const on = mode !== "single" && compareMode === mode;
                      return (
                        <button
                          type="button"
                          key={mode}
                          aria-pressed={on}
                          onClick={() =>
                            mode === "single" ? setComparison(null) : setCompareMode(mode)
                          }
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition",
                            on
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {comparison ? (
                  <div className="flex justify-between gap-2 text-2xs text-muted-foreground">
                    <span className="truncate">A · {comparison.name}</span>
                    <span className="truncate">B · {selected.name}</span>
                  </div>
                ) : null}
                {!isArtifactVideo(selected) && (
                  <div
                    ref={filmstrip}
                    className="artifact-filmstrip flex shrink-0 gap-2 overflow-x-auto rounded-xl bg-secondary/70 p-2"
                    aria-label="图片胶片条"
                    onScroll={(e) => {
                      if (
                        e.currentTarget.scrollLeft + e.currentTarget.clientWidth >=
                        e.currentTarget.scrollWidth - 40
                      )
                        setThumbCount((n) => n + 40);
                    }}
                  >
                    {images.slice(0, thumbCount).map((a) => {
                      const isCurrent = artifactVersionKey(a) === artifactVersionKey(selected);
                      const isComparison =
                        comparison !== null &&
                        artifactVersionKey(a) === artifactVersionKey(comparison);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          data-film-key={artifactVersionKey(a)}
                          className={cn(
                            "size-12 shrink-0 overflow-hidden rounded-lg transition duration-150",
                            isCurrent
                              ? "scale-105 opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-secondary"
                              : isComparison
                                ? "opacity-95 outline-2 -outline-offset-2 outline-dashed outline-primary"
                                : "opacity-60 hover:opacity-100",
                          )}
                          aria-label={`查看 ${a.name}（按住 Shift 或 Option 点击设为对比图）`}
                          aria-current={isCurrent ? "true" : undefined}
                          onClick={(event) => {
                            if (event.shiftKey || event.altKey) {
                              if (isCurrent) return;
                              setComparison(a);
                              setCompareMode("slider");
                              return;
                            }
                            setSelected(a);
                            if (isComparison) setComparison(null);
                          }}
                        >
                          {thumb(a, "size-full object-cover")}
                        </button>
                      );
                    })}
                  </div>
                )}
                {actionError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {actionError}
                  </p>
                ) : null}
                {revisionEnabled && selected.kind === "image" && onRevise ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    <label htmlFor="artifact-revision-note" className="text-xs">
                      修改意见
                    </label>
                    <textarea
                      id="artifact-revision-note"
                      rows={2}
                      maxLength={8000}
                      className="w-full resize-y rounded-md border border-border bg-background p-2 text-sm"
                      placeholder="例如：修正人物右手边缘，保留构图和其他区域。"
                      value={revisionNote}
                      onChange={(event) => {
                        const note = event.currentTarget.value;
                        setRevisionNotes((notes) => ({ ...notes, [revisionKey]: note }));
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        加入当前会话草稿后发送；完成后选择两张图片对比。
                      </span>
                      <Button
                        size="sm"
                        disabled={!selectedIsCurrent || !revisionNote.trim()}
                        onClick={requestRevision}
                      >
                        加入返工草稿
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => void reveal(selected)}>
                    在 Finder 中显示
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void attach(selected)}>
                    {busy ? "正在附加…" : "附加到输入框"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
