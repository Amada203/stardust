import { readUiLocale } from "~/i18n";

// Feature-local copy keeps concurrent catalog edits independent.
export function cleanupText(english: string, chinese: string) {
  return readUiLocale() === "zh-CN" ? chinese : english;
}

export function cleanupCategoryLabel(category: string): string {
  const labels: Record<string, readonly [string, string]> = {
    "developer-cache": ["Developer cache", "开发工具缓存"],
    "browser-cache": ["Browser cache", "浏览器缓存"],
    "user-cache": ["User cache", "用户缓存"],
    "system-cache": ["System cache", "系统缓存"],
    "rollback-apps": ["Rollback versions", "旧回滚版本"],
    "cold-backups": ["Cold backups", "冷备份"],
    "old-builds": ["Old candidates", "旧候选 / 暂存"],
    "project-artifacts": ["Build artifacts", "项目生成物"],
    installers: ["Installers", "安装包"],
    "large-old-files": ["Downloads", "下载资料"],
    cache: ["Cache", "缓存"],
    logs: ["Logs", "日志"],
    backups: ["Backups", "备份"],
    protected: ["Protected", "受保护"],
    database: ["Chat database", "聊天数据库"],
    attachments: ["Attachments", "附件"],
    scratch: ["Workspaces", "工作区"],
    trash: ["Trash", "废纸篓"],
  };
  const label = labels[category];
  return label ? cleanupText(label[0], label[1]) : category;
}
