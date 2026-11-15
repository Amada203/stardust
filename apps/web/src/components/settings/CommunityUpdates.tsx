import { useEffect } from "react";
import { isElectron } from "../../env";
import { useCommunityUpdates } from "../../state/communityUpdates";
import {
  COMMUNITY_BASE_TAG,
  COMMUNITY_CHECK_INTERVAL_MS,
  COMMUNITY_RELEASES_URL,
  communityUpdateActions,
} from "../../state/communityUpdates.logic";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { openDesktopUpdateReleaseNotes } from "../desktopUpdate.toast";
const openPage = (url: string) => {
  void openDesktopUpdateReleaseNotes(window.desktopBridge, url);
};
export function CommunityUpdateCoordinator() {
  const automatic = useCommunityUpdates((s) => s.automatic);
  const release = useCommunityUpdates((s) => s.release);
  const status = useCommunityUpdates((s) => s.status);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Own the desktop update polling timers while this coordinator is mounted.
  useEffect(() => {
    if (!isElectron || !automatic) return;
    const timer = window.setTimeout(() => {
      void useCommunityUpdates.getState().check();
    }, 10_000);
    const interval = window.setInterval(() => {
      void useCommunityUpdates.getState().check();
    }, COMMUNITY_CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [automatic]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Synchronize the imperative toast surface with a newly observed community release.
  useEffect(() => {
    if (!isElectron || status !== "available" || !release) return;
    const state = useCommunityUpdates.getState();
    if (state.notifiedTag === release.tag) return;
    state.markNotified(release.tag);
    toastManager.add({
      type: "info",
      title: `小新社区版 C${release.number} 已发布`,
      description: (
        <>
          <span>
            {state.mode === "custom"
              ? "自行改造模式：请先查看差异，按需合并；不会替换应用。"
              : "可查看更新内容，确认后自行下载；不会自动安装。"}
          </span>
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => openPage(state.mode === "custom" ? release.compareUrl : release.url)}
          >
            查看更新
          </button>
        </>
      ),
    });
  }, [release, status]);
  return null;
}
export function CommunityUpdateSettings() {
  const state = useCommunityUpdates();
  const actions = communityUpdateActions(state.mode);
  return (
    <>
      <SettingsRow
        title="社区更新模式"
        description="标准模式提供发行下载入口；自行改造模式提供源码差异。两种模式都不会自动下载、安装或重启。"
        control={
          <select
            aria-label="社区更新模式"
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={state.mode}
            onChange={(e) => state.setMode(e.target.value === "standard" ? "standard" : "custom")}
          >
            <option value="custom">自行改造 · 仅提醒</option>
            <option value="standard">标准版 · 手动确认更新</option>
          </select>
        }
      />
      <SettingsRow
        title="自动检查社区更新"
        description="启动后及每 6 小时检查一次 GitHub 公开发行；不发送聊天、账号或项目数据。"
        control={
          <Switch
            aria-label="自动检查社区更新"
            checked={state.automatic}
            onCheckedChange={state.setAutomatic}
          />
        }
      />
      <SettingsRow
        title="小新社区版 · Mac Apple Silicon"
        description={
          state.status === "checking"
            ? "正在检查…"
            : state.status === "available"
              ? `发现 C${state.release?.number}；${state.mode === "custom" ? "先查看差异，按需合并源码" : "查看说明后手动下载"}`
              : state.status === "current"
                ? "未发现比当前社区基线更新的正式版"
                : "仅检查小新社区发行，不使用上游官方自动更新源。"
        }
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={state.status === "checking"}
            onClick={() => {
              void state.check(true);
            }}
          >
            检查更新
          </Button>
        }
      />
      <div className="space-y-2 px-1 text-sm text-muted-foreground">
        <p>社区基线：{COMMUNITY_BASE_TAG}。此编号不代表本地源码未改动。</p>
        {state.error && <p role="status">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openPage(state.release?.url ?? COMMUNITY_RELEASES_URL)}
          >
            查看发行说明
          </Button>
          {state.status === "available" && state.release && actions.canOpenDownloadPage && (
            <Button size="sm" onClick={() => openPage(state.release!.url)}>
              前往下载页
            </Button>
          )}
          {state.status === "available" && state.release && actions.canViewSourceDiff && (
            <Button size="sm" variant="outline" onClick={() => openPage(state.release!.compareUrl)}>
              查看源码差异
            </Button>
          )}
        </div>
        {state.mode === "custom" && (
          <p>请在自己的 fork 中审阅并合并所需修改，再构建；整包覆盖可能替换你的代码改造。</p>
        )}
      </div>
    </>
  );
}
