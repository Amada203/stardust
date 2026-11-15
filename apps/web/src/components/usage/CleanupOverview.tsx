import type { StorageActionInput, StorageInspection, StorageOperation } from "@t3tools/contracts";
import { useId, useRef, useState } from "react";
import { Button } from "../ui/button";
import { formatBytes } from "../../lib/formatBytes";
import {
  cleanupSuggestionGroups,
  selectedSafeBytes,
  GIB,
  selectedCleanupEntry,
  volumeGauge,
} from "./cleanupModel";
import { cleanupText as text } from "./cleanupText";
import { type StorageEntry } from "./storageInventoryModel";
import { CleanupDetails } from "./CleanupDetails";
import styles from "./cleanupOverview.module.css";

const groups = [
  { id: "safe", en: "Verified generated files", zh: "已核验的生成文件" },
  { id: "review", en: "Review before releasing", zh: "需要你确认" },
  { id: "locked", en: "Protected or not yet verified", zh: "已保护 / 尚未核验" },
] as const;

function VolumeGauge({ volume }: { volume: StorageInspection["volumes"][number] }) {
  const gauge = volumeGauge(volume);
  const angle = ((gauge.reservePercent ?? 0) / 100) * Math.PI * 2 - Math.PI / 2;
  return (
    <div className={styles.volume} data-low={gauge.low}>
      <div className={styles.dial}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className={styles.track} cx="60" cy="60" r="50" />
          {gauge.freePercent !== null ? (
            <>
              <circle
                className={styles.arc}
                cx="60"
                cy="60"
                r="50"
                pathLength="100"
                strokeDasharray={`${gauge.freePercent} 100`}
                transform="rotate(-90 60 60)"
              />
              <line
                className={styles.tick}
                x1={60 + 43 * Math.cos(angle)}
                y1={60 + 43 * Math.sin(angle)}
                x2={60 + 57 * Math.cos(angle)}
                y2={60 + 57 * Math.sin(angle)}
              />
            </>
          ) : null}
        </svg>
        <div className={styles.dialValue}>
          <strong key={volume.freeBytes} className={styles.number}>
            {(volume.freeBytes / GIB).toFixed(1)}
          </strong>
          <span>GiB {text("free", "可用")}</span>
        </div>
      </div>
      <div className={styles.volumeCaption}>
        <strong>{volume.name}</strong>
        <span>
          {volume.totalBytes
            ? `${text("Total", "总容量")} ${(volume.totalBytes / GIB).toFixed(0)} GiB`
            : text("Total unavailable", "总容量未知")}
        </span>
        <span className={styles.reserve}>
          {gauge.low ? text("Below", "低于") : text("Reserve", "保护线")} {volume.reserveGiB ?? 40}{" "}
          GiB ·{" "}
          {volume.reserveGiB === undefined
            ? text("display only", "仅显示")
            : text("enforced", "执行保护")}
        </span>
      </div>
    </div>
  );
}

export function CleanupOverview({
  data,
  allowed,
  busy,
  scanning,
  volumeId,
  onVolumeChange,
  onScan,
  onPreview,
  completed,
  previewPlan,
  onSettings,
}: {
  onSettings?: (input: Extract<StorageActionInput, { action: "cleanup-settings" }>) => void;
  data: StorageInspection;
  allowed: boolean;
  busy: boolean;
  scanning: boolean;
  volumeId: string;
  onVolumeChange: (id: string) => void;
  onScan: () => void;
  onPreview: (entry: StorageEntry) => void;
  onLogsPreview: () => void;
  completed: StorageOperation | undefined;
  previewPlan: StorageOperation | null;
}) {
  const selectionName = useId();
  const awaitingConfirmation = previewPlan?.phase === "planned";
  const controlsDisabled = busy || awaitingConfirmation;
  const [selection, setSelection] = useState<string | null | undefined>(undefined);
  const selected = selectedCleanupEntry(data.entries, selection);
  const suggestionsRef = useRef<HTMLElement>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const suggestions = cleanupSuggestionGroups(data.entries);
  const releaseBytes = selectedSafeBytes(selected);
  const reviewBytes = suggestions
    .filter((g) => g.risk === "review")
    .reduce((sum, g) => sum + g.bytes, 0);
  const hasReview = suggestions.some((g) => g.risk === "review");
  const small = suggestions.filter((g) => g.small);
  const showSuggestions = () => {
    setReviewRequest((request) => request + 1);
    suggestionsRef.current?.scrollIntoView({ block: "start" });
  };
  const titleFor = (g: (typeof suggestions)[number]) =>
    g.entries.length === 1
      ? g.entries[0]!.name
      : `${g.category === "rollback-apps" ? text("Old T3 rollback apps", "旧 T3 回滚版本") : g.category === "old-builds" ? text("Build staging", "外盘构建暂存") : text("Cold backups", "冷备份")} ×${g.entries.length}`;
  const renderSuggestion = (g: (typeof suggestions)[number]) => (
    <div key={g.id} className={styles.entry}>
      <div className={styles.entryChoice}>
        <strong className={styles.entryName}>{titleFor(g)}</strong>
        <span className={styles.entryBytes}>
          {g.incomplete ? (g.bytes ? "≥ " : "") : ""}
          {g.bytes || !g.incomplete ? formatBytes(g.bytes) : text("Not measured", "尚未测量")}
        </span>
      </div>
      <p>
        {g.risk === "locked" ? text("Locked · ", "已加锁 · ") : ""}
        {g.entries[0]!.reason}
      </p>
      <p>
        {g.entries[0]!.destination === "trash"
          ? text("Move to Trash · no immediate space released", "移入废纸篓 · 不立即释放空间")
          : g.entries[0]!.destination === "delete-rebuildable"
            ? text("Delete · rebuildable", "永久删除 · 可重建")
            : ""}
      </p>
      <details
        className={styles.path}
        open={(g.entries.length > 1 && g.entries.some((e) => e.id === selected?.id)) || undefined}
      >
        <summary>
          {text("Paths and dates · review one item at a time", "路径与日期 · 逐项复核")}
        </summary>
        {g.entries.map((entry) => (
          <div key={entry.id}>
            <label className={styles.entryChoice}>
              {g.entries.length > 1 ? (
                <input
                  type="radio"
                  name={selectionName}
                  checked={selected?.id === entry.id}
                  disabled={g.risk === "locked" || controlsDisabled || !allowed}
                  onChange={() => setSelection(entry.id)}
                />
              ) : null}
              <span className={styles.entryName}>{entry.path}</span>
              <span>
                {entry.bytes == null ? text("Not measured", "尚未测量") : formatBytes(entry.bytes)}
              </span>
            </label>
            {entry.childPaths?.map((path) => (
              <span key={path}>{path}</span>
            ))}
            {entry.modifiedAt ? <span>{new Date(entry.modifiedAt).toLocaleString()}</span> : null}
          </div>
        ))}
      </details>
      {g.entries.length === 1 && g.risk !== "locked" ? (
        <label className={styles.entryChoice}>
          <input
            type="radio"
            name={selectionName}
            aria-label={`${text("Select", "选择")} ${g.entries[0]!.name}`}
            checked={selected?.id === g.entries[0]!.id}
            disabled={controlsDisabled || !allowed}
            onChange={() => setSelection(g.entries[0]!.id)}
          />
          <span>{text("Select for preview", "选择并预览")}</span>
        </label>
      ) : null}
    </div>
  );
  const targets = data.volumes.filter((volume) => volume.internal === false);
  const target = targets.find((volume) => volume.id === volumeId);
  return (
    <div className={styles.root}>
      <header className={styles.heading}>
        <div>
          <h3>{text("Cleanup & organization", "清理与整理")}</h3>
          <p>
            {text(
              "Preview paths and destinations before confirming.",
              "先预览路径与去向，再确认清理。",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={controlsDisabled || scanning}
          onClick={onScan}
        >
          {scanning ? text("Scanning…", "正在扫描…") : text("Scan sizes", "扫描大小")}
        </Button>
      </header>
      {scanning ? (
        <p role="status" className={styles.scan}>
          {text(
            "Measuring managed directories. No files are being removed.",
            "正在测量可管理目录，未删除任何文件。",
          )}
          {data.scan ? ` ${data.scan.checked} / ${data.scan.total} · ${data.scan.current}` : ""}
        </p>
      ) : null}
      <div className={styles.hero}>
        <div className={styles.action}>
          <span className={styles.eyebrow}>{text("Selected safe space", "已选安全项可释放")}</span>
          {releaseBytes > 0 ? (
            <div className={styles.amount}>
              <strong key={releaseBytes} className={styles.number}>
                {(releaseBytes / GIB).toFixed(1)}
              </strong>
              <span>GiB</span>
            </div>
          ) : (
            <strong className={styles.emptyAmount}>
              {text("No safe items selected for release", "暂无可直接释放的安全项")}
            </strong>
          )}
          <p>
            {releaseBytes > 0
              ? text(
                  "Only the selected safe object is counted; actual free space is measured after completion.",
                  "仅统计已选安全项；实际释放量以完成后实测为准。",
                )
              : hasReview
                ? `${text("Another", "另有")} ${(reviewBytes / GIB).toFixed(1)} GiB ${text("needs your review", "需你确认")}`
                : text(
                    "Scan or select a verified object from the suggestions.",
                    "扫描或从建议中选择已核验对象。",
                  )}
          </p>
          <Button
            size="lg"
            disabled={
              !allowed ||
              controlsDisabled ||
              scanning ||
              (selected !== undefined && !selected.destination && !target)
            }
            onClick={() =>
              selected ? onPreview(selected) : suggestions.length ? showSuggestions() : onScan()
            }
          >
            {awaitingConfirmation
              ? text("Confirm the plan below", "请在下方确认计划")
              : busy
                ? text("Processing…", "正在处理…")
                : selected
                  ? text("Preview cleanup →", "预览清理 →")
                  : hasReview
                    ? text("Review confirmation items", "查看需确认项")
                    : suggestions.length
                      ? text("View suggestions", "查看建议")
                      : text("Scan", "扫描")}
          </Button>
          <span className={styles.hint}>
            {selected
              ? `${text("Selected", "已选")} ${selected.name} · ${selected.bytes == null ? text("Not measured", "尚未测量") : formatBytes(selected.bytes)}`
              : text(
                  "Logs older than 30 days; confirm the exact list before cleanup.",
                  "扫描后可手动选择需要确认的项目。",
                )}
          </span>
          {selected && !selected.destination ? (
            <label className={styles.destination}>
              {text("Archive destination", "归档到")}
              <select
                value={volumeId}
                disabled={controlsDisabled}
                onChange={(event) => onVolumeChange(event.target.value)}
              >
                <option value="">{text("Choose external volume", "选择外置卷")}</option>
                {targets.map((volume) => (
                  <option key={volume.id} value={volume.id}>
                    {volume.name} · {formatBytes(volume.freeBytes)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className={styles.volumes}>
          {data.volumes.map((volume) => (
            <VolumeGauge key={volume.id} volume={volume} />
          ))}
          {data.volumes.length === 0 ? (
            <p>{text("Volume information unavailable.", "暂未取得磁盘容量信息。")}</p>
          ) : null}
        </div>
      </div>
      {completed ? (
        <div key={completed.id} role="status" className={styles.completed}>
          <strong>{text("Cleanup completed", "清理已完成")}</strong>
          {completed.freeBefore !== undefined && completed.freeAfter !== undefined ? (
            <span>
              {text("Observed free-space change", "实测空闲变化")}{" "}
              {completed.freeAfter >= completed.freeBefore ? "+" : "−"}
              {formatBytes(Math.abs(completed.freeAfter - completed.freeBefore))} ·{" "}
              {text("includes other disk activity", "含其他磁盘活动")}
            </span>
          ) : (
            <span>{text("Refreshing space measurements", "正在刷新空间测量")}</span>
          )}
        </div>
      ) : null}
      <section
        ref={suggestionsRef}
        className={styles.suggestions}
        aria-label={text("Cleanup suggestions", "整理建议")}
      >
        <div className={styles.listHeading}>
          <h4>{text("Cleanup suggestions", "整理建议")}</h4>
          <span>
            {text(
              "Largest safe object ≥200 MB preselected; review each path.",
              "仅默认选中 ≥200 MB 的最大安全项；逐项预览。",
            )}
          </span>
        </div>
        {[
          ...new Set([...data.volumes.map((v) => v.path), ...suggestions.map((g) => g.volumePath)]),
        ].map((path) => {
          const items = suggestions.filter((g) => g.volumePath === path && !g.small);
          if (!items.length) return null;
          return (
            <div key={path} className={styles.volumeGroup}>
              <h4>{data.volumes.find((v) => v.path === path)?.name ?? path}</h4>
              {groups.map((group) => {
                const objects = items.filter((g) => g.risk === group.id);
                if (!objects.length) return null;
                return (
                  <details
                    key={`${group.id}:${reviewRequest}`}
                    className={styles.group}
                    open={group.id !== "locked" || undefined}
                  >
                    <summary>
                      <span>{text(group.en, group.zh)}</span>
                      <span>
                        {objects.length} {text("objects", "项建议")}
                      </span>
                    </summary>
                    <div className={styles.entries}>{objects.map(renderSuggestion)}</div>
                  </details>
                );
              })}
            </div>
          );
        })}
        {small.length ? (
          <details className={styles.group}>
            <summary>
              <span>
                {text("More small objects", "还有")} {small.length}{" "}
                {text("small objects (<50 MB)", "个小项（<50 MB）")}
              </span>
            </summary>
            <div className={styles.entries}>{small.map(renderSuggestion)}</div>
          </details>
        ) : null}
        {!suggestions.length ? (
          <p>{text("No nonempty objects in this scan.", "本次扫描没有非空清理对象。")}</p>
        ) : null}
        {selected ? (
          <button
            className={styles.clear}
            type="button"
            disabled={controlsDisabled}
            onClick={() => setSelection(null)}
          >
            {text("Clear selection", "取消选择")}
          </button>
        ) : null}
        {data.truncated ? (
          <p>
            {text(
              "Scan limit reached; inspect individual directories below.",
              "已达扫描上限，可在下方逐个检查目录。",
            )}
          </p>
        ) : null}
      </section>
      <CleanupDetails
        data={data}
        disabled={controlsDisabled || !allowed}
        onSettings={onSettings}
        onSelect={(id) => setSelection(id)}
      />
      <p className={styles.scope}>
        {text(
          "Bounded allowlist scan; protected data is never selected. Trash does not free disk space.",
          "仅限白名单范围；受保护数据不会选中。移入废纸篓不会立即释放磁盘空间。",
        )}
      </p>
      {!allowed ? (
        <p className={styles.scope}>
          {text("This connection has view-only storage access.", "此连接仅可查看，不能执行整理。")}
        </p>
      ) : null}
    </div>
  );
}
