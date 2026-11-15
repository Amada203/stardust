import { create } from "zustand";
import {
  COMMUNITY_BASE_TAG,
  COMMUNITY_CHECK_INTERVAL_MS,
  COMMUNITY_REPOSITORY,
  communityReleaseNumber,
  parseCommunityRelease,
  type CommunityRelease,
  type CommunityUpdateMode,
} from "./communityUpdates.logic";
const KEY = "t3code:community-updates:v1";
type Preferences = {
  mode: CommunityUpdateMode;
  automatic: boolean;
  lastAttempt: number;
  notifiedTag: string;
};
function readPreferences(): Preferences {
  const defaults: Preferences = {
    mode: "custom",
    automatic: true,
    lastAttempt: 0,
    notifiedTag: "",
  };
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object") return defaults;
    const v = value as Record<string, unknown>;
    return {
      mode: v.mode === "standard" ? "standard" : "custom",
      automatic: typeof v.automatic === "boolean" ? v.automatic : defaults.automatic,
      lastAttempt:
        typeof v.lastAttempt === "number" &&
        Number.isFinite(v.lastAttempt) &&
        v.lastAttempt > 0 &&
        v.lastAttempt <= Date.now()
          ? v.lastAttempt
          : 0,
      notifiedTag: typeof v.notifiedTag === "string" ? v.notifiedTag : "",
    };
  } catch {
    return defaults;
  }
}
interface CommunityUpdatesState extends Preferences {
  status: "idle" | "checking" | "available" | "current" | "error";
  release: CommunityRelease | null;
  error: string | null;
  setMode: (mode: CommunityUpdateMode) => void;
  setAutomatic: (automatic: boolean) => void;
  markNotified: (tag: string) => void;
  check: (manual?: boolean) => Promise<void>;
}
let pending: Promise<void> | null = null;
export const useCommunityUpdates = create<CommunityUpdatesState>((set, get) => {
  const save = (patch: Partial<Preferences>) => {
    set(patch);
    const { mode, automatic, lastAttempt, notifiedTag } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, automatic, lastAttempt, notifiedTag }));
    } catch {
      set({ error: "更新偏好暂时无法保存，重启后可能恢复默认值" });
    }
  };
  return {
    ...readPreferences(),
    status: "idle",
    release: null,
    error: null,
    setMode: (mode) => save({ mode }),
    setAutomatic: (automatic) => save({ automatic }),
    markNotified: (tag) => save({ notifiedTag: tag }),
    check: (manual = false) => {
      if (pending) return pending;
      if (
        !manual &&
        (!get().automatic || Date.now() - get().lastAttempt < COMMUNITY_CHECK_INTERVAL_MS)
      )
        return Promise.resolve();
      save({ lastAttempt: Date.now() });
      set({ status: "checking", error: null });
      pending = (async () => {
        try {
          const response = await fetch(
            `https://api.github.com/repos/${COMMUNITY_REPOSITORY}/releases/latest`,
            {
              credentials: "omit",
              referrerPolicy: "no-referrer",
              headers: { Accept: "application/vnd.github+json" },
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (!response.ok)
            throw new Error(
              response.status === 403 || response.status === 429
                ? "检查过于频繁或 GitHub 暂时限制访问，请稍后再试"
                : `检查失败（HTTP ${response.status}）`,
            );
          const release = parseCommunityRelease(await response.json());
          const baseline = communityReleaseNumber(COMMUNITY_BASE_TAG);
          if (baseline === null) throw new Error("本地社区基线未知，请手动查看发行页");
          set({ status: release.number > baseline ? "available" : "current", release });
        } catch (error) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "暂时无法连接 GitHub，请稍后重试",
          });
        }
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
});
