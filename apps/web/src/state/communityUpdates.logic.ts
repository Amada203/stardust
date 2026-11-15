/** Community releases are independent of upstream Electron version numbers. */
export const COMMUNITY_BASE_TAG = "xiaoxin-c47-macos-20261111";
export const COMMUNITY_REPOSITORY = "zds-xiaoxin/xiaoxin-t3code";
export const COMMUNITY_RELEASES_URL = `https://github.com/${COMMUNITY_REPOSITORY}/releases`;
export const COMMUNITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export type CommunityUpdateMode = "standard" | "custom";
export interface CommunityRelease {
  tag: string;
  number: number;
  url: string;
  compareUrl: string;
}
export function communityReleaseNumber(tag: string): number | null {
  const match = /^xiaoxin-c([1-9]\d*)-macos-\d{8}$/.exec(tag);
  const number = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(number) ? number : null;
}
export function parseCommunityRelease(value: unknown): CommunityRelease {
  if (!value || typeof value !== "object") throw new Error("发行信息格式不正确");
  const release = value as Record<string, unknown>;
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  const number = communityReleaseNumber(tag);
  if (number === null || release.draft !== false || release.prerelease !== false) {
    throw new Error("最新发行不是可用的 Mac 社区正式版");
  }
  if (
    !Array.isArray(release.assets) ||
    !release.assets.some((asset: unknown) => {
      if (!asset || typeof asset !== "object") return false;
      const file = asset as Record<string, unknown>;
      return (
        file.name === `Xiaoxin-T3-Code-C${number}-macOS-arm64.zip` &&
        file.state === "uploaded" &&
        typeof file.size === "number" &&
        file.size > 0 &&
        typeof file.digest === "string" &&
        /^sha256:[a-f0-9]{64}$/.test(file.digest)
      );
    })
  )
    throw new Error("该发行尚无完整且可校验的 Mac Apple Silicon 安装包");
  // Construct trusted URLs; do not follow arbitrary URLs supplied by a response.
  return {
    tag,
    number,
    url: `${COMMUNITY_RELEASES_URL}/tag/${tag}`,
    compareUrl: `https://github.com/${COMMUNITY_REPOSITORY}/compare/${COMMUNITY_BASE_TAG}...${tag}`,
  };
}
export function communityUpdateActions(mode: CommunityUpdateMode) {
  return {
    canOpenDownloadPage: mode === "standard",
    canViewSourceDiff: mode === "custom",
    canInstall: false as const,
  };
}
