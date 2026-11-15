import { useState } from "react";
import type { StorageActionInput, StorageInspection } from "@t3tools/contracts";
import { Button } from "../ui/button";
import { cleanupRisk, GIB } from "./cleanupModel";
import { formatBytes } from "../../lib/formatBytes";
import { cleanupText as text, cleanupCategoryLabel } from "./cleanupText";
import styles from "./cleanupOverview.module.css";

function splitTiles(
  rows: ReadonlyArray<{ id: string; bytes: number }>,
  x = 0,
  y = 0,
  width = 100,
  height = 100,
): Array<{ id: string; x: number; y: number; width: number; height: number }> {
  if (!rows.length) return [];
  if (rows.length === 1) return [{ id: rows[0]!.id, x, y, width, height }];
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);
  let cut = 1,
    sum = rows[0]!.bytes;
  while (cut < rows.length - 1 && sum < total / 2) {
    sum += rows[cut]!.bytes;
    cut++;
  }
  const fraction = sum / total;
  return width >= height
    ? [
        ...splitTiles(rows.slice(0, cut), x, y, width * fraction, height),
        ...splitTiles(rows.slice(cut), x + width * fraction, y, width * (1 - fraction), height),
      ]
    : [
        ...splitTiles(rows.slice(0, cut), x, y, width, height * fraction),
        ...splitTiles(rows.slice(cut), x, y + height * fraction, width, height * (1 - fraction)),
      ];
}

export function CleanupDetails({
  data,
  disabled,
  onSettings,
  onSelect,
}: {
  data: StorageInspection;
  disabled: boolean;
  onSettings?:
    | ((input: Extract<StorageActionInput, { action: "cleanup-settings" }>) => void)
    | undefined;
  onSelect: (id: string) => void;
}) {
  const [volumePath, setVolumePath] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const volume = data.volumes.find((v) => v.path === volumePath) ?? data.volumes[0];
  const entries = data.entries.filter(
    (e) => (!volume || e.volumePath === volume.path) && e.bytes != null && e.bytes > 0,
  );
  const nonOverlapping = entries.filter(
    (e) => !entries.some((other) => other.id !== e.id && e.path.startsWith(other.path + "/")),
  );
  const grouped = new Map<string, number>();
  for (const e of nonOverlapping)
    grouped.set(e.category ?? e.kind, (grouped.get(e.category ?? e.kind) ?? 0) + (e.bytes ?? 0));
  const rows = category
    ? nonOverlapping
        .filter((e) => (e.category ?? e.kind) === category)
        .map((e) => ({ id: e.id, bytes: e.bytes ?? 0 }))
    : [...grouped].map(([id, bytes]) => ({ id, bytes }));
  const tiles = splitTiles(rows.toSorted((a, b) => b.bytes - a.bytes));
  return (
    <details className={styles.group}>
      <summary>
        <span>{text("Space map & protection", "空间构成与保护设置")}</span>
        <span>{text("Details", "展开")}</span>
      </summary>
      <div className={styles.detailsBody}>
        <label className={styles.destination}>
          {text("Volume", "磁盘")}
          <select
            value={volume?.path ?? ""}
            onChange={(e) => {
              setVolumePath(e.target.value);
              setCategory(null);
            }}
          >
            {data.volumes.map((v) => (
              <option key={v.id} value={v.path}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.listHeading}>
          <button type="button" className={styles.clear} onClick={() => setCategory(null)}>
            {text("Measured items", "已测量项目")}
          </button>
          <span>
            {category
              ? cleanupCategoryLabel(category)
              : text("Select a category to drill down", "点分类下钻；未测量项目不计入")}
          </span>
        </div>
        <div
          className={styles.treemap}
          aria-label={text("Measured storage treemap", "已测量空间树图")}
        >
          {tiles.map((tile, index) => {
            const entry = category ? nonOverlapping.find((e) => e.id === tile.id) : undefined;
            const row = rows.find((r) => r.id === tile.id)!;
            return (
              <button
                type="button"
                key={tile.id}
                aria-label={`${entry?.path ?? cleanupCategoryLabel(tile.id)} · ${formatBytes(row.bytes)}`}
                style={{
                  left: `${tile.x}%`,
                  top: `${tile.y}%`,
                  width: `${tile.width}%`,
                  height: `${tile.height}%`,
                  opacity: 1 - (index % 3) * 0.12,
                }}
                disabled={disabled || (!!entry && cleanupRisk(entry) === "locked")}
                onClick={() => (entry ? onSelect(entry.id) : setCategory(tile.id))}
              >
                <strong>{entry?.name ?? cleanupCategoryLabel(tile.id)}</strong>
                <span>{formatBytes(row.bytes)}</span>
              </button>
            );
          })}
          {!tiles.length ? (
            <p>
              {text("No measured entries on this volume yet.", "此卷暂无已测量项目，请先扫描。")}
            </p>
          ) : null}
        </div>
        <div className={styles.settingsGrid}>
          {data.volumes.map((v) => (
            <form
              className={styles.protection}
              key={`${v.id}:${v.reserveGiB}`}
              onSubmit={(event) => {
                event.preventDefault();
                const reserve = Number(new FormData(event.currentTarget).get("reserve"));
                if (Number.isFinite(reserve) && reserve >= 40 && reserve <= 1024)
                  onSettings?.({
                    action: "cleanup-settings",
                    volumePath: v.path,
                    reserveGiB: reserve,
                  });
              }}
            >
              <strong>{v.name}</strong>
              <label>
                {text("Reserve GiB (minimum 40)", "保护线 GiB（最低40）")}
                <input
                  name="reserve"
                  type="number"
                  min="40"
                  max="1024"
                  step="1"
                  required
                  defaultValue={v.reserveGiB ?? 40}
                  disabled={disabled || !onSettings}
                />
              </label>
              <Button type="submit" variant="outline" size="sm" disabled={disabled || !onSettings}>
                {text("Save", "保存")}
              </Button>
              {v.freeBytes < (v.reserveGiB ?? 40) * GIB ? (
                <p role="alert">
                  {text(
                    "Below reserve. Execution will be refused.",
                    "已低于保护线，执行会被拒绝。",
                  )}
                </p>
              ) : null}
              {(v.history?.length ?? 0) > 1 ? (
                <svg
                  viewBox="0 0 240 60"
                  role="img"
                  aria-label={text("Free space history", "空闲空间历史")}
                >
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points={v
                      .history!.map(
                        (sample, i) =>
                          `${(i * 240) / (v.history!.length - 1)},${55 - Math.min(1, sample.freeBytes / (v.totalBytes ?? Math.max(...v.history!.map((s) => s.freeBytes)))) * 50}`,
                      )
                      .join(" ")}
                  />
                </svg>
              ) : (
                <span>{text("History accumulates after scans", "扫描后逐日积累历史")}</span>
              )}
            </form>
          ))}
        </div>
        <label className={styles.entryChoice}>
          <input
            type="checkbox"
            checked={data.scanOnOpenDaily ?? false}
            disabled={disabled || !onSettings}
            onChange={(event) =>
              onSettings?.({ action: "cleanup-settings", scanOnOpenDaily: event.target.checked })
            }
          />
          {text("Scan once daily when this page is opened", "每天打开此页时自动扫描一次")}
        </label>
        <p className={styles.scope}>
          {text(
            "No background timer or automatic deletion. Trash is retained until manually restored or emptied.",
            "没有常驻扫描或自动删除。废纸篓内容由你恢复或清空；T3不会在7天后自动删除。",
          )}
        </p>
      </div>
    </details>
  );
}
