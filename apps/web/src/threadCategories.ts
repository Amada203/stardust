import { useSyncExternalStore } from "react";

/**
 * Sidebar categories: a display-only relation layered over projects. Threads keep their
 * project, workspace and id; a category only decides which sidebar row lists them.
 */
export interface ThreadCategory {
  readonly id: string;
  readonly label: string;
  readonly group: ThreadCategoryGroup;
}
export type ThreadCategoryGroup = "内容与账号" | "公司与业务" | "工具与系统" | "待归类";
export const THREAD_CATEGORY_GROUPS: readonly ThreadCategoryGroup[] = [
  "内容与账号",
  "公司与业务",
  "工具与系统",
  "待归类",
];
export const UNSORTED_CATEGORY_ID = "unsorted";
export const THREAD_CATEGORIES: readonly ThreadCategory[] = [
  { id: "wechat", label: "公众号", group: "内容与账号" },
  { id: "douyin-real", label: "抖音 · 真人主号", group: "内容与账号" },
  { id: "douyin-ai", label: "抖音 · 一根 AI", group: "内容与账号" },
  { id: "douyin-other", label: "抖音 · 其他", group: "内容与账号" },
  { id: "xiaohongshu", label: "小红书", group: "内容与账号" },
  { id: "x", label: "X", group: "内容与账号" },
  { id: "xiaodao", label: "小岛经济学", group: "内容与账号" },
  { id: "video", label: "视频 · 动画 · 音乐", group: "内容与账号" },
  { id: "content-other", label: "其他内容", group: "内容与账号" },
  { id: "company", label: "公司经营", group: "公司与业务" },
  { id: "client", label: "客户交付", group: "公司与业务" },
  { id: "product", label: "产品与网站", group: "公司与业务" },
  { id: "invest", label: "投资研究", group: "公司与业务" },
  { id: "t3", label: "T3 功能与维护", group: "工具与系统" },
  { id: "models", label: "模型与账号", group: "工具与系统" },
  { id: "automation", label: "自动化与知识库", group: "工具与系统" },
  { id: "devices", label: "电脑与设备", group: "工具与系统" },
  { id: "tools-other", label: "其他工具", group: "工具与系统" },
  { id: UNSORTED_CATEGORY_ID, label: "待归类", group: "待归类" },
];
const CATEGORY_BY_ID = new Map(THREAD_CATEGORIES.map((category) => [category.id, category]));
export function threadCategoryById(id: string): ThreadCategory {
  return CATEGORY_BY_ID.get(id) ?? CATEGORY_BY_ID.get(UNSORTED_CATEGORY_ID)!;
}

// Ordered: account/platform words win over generic topic words, so "T3 工作台 X 文章"
// stays content and "Claude视频抖音发布" stays on Douyin.
const TITLE_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["xiaodao", /小岛/],
  ["wechat", /公众号/],
  ["xiaohongshu", /小红书/],
  ["douyin-real", /真人主号|橙镜/],
  ["douyin-ai", /一根\s*AI|AI\s*时代普通人的机会/i],
  ["x", /(?:^|[^A-Za-z])X\s*(?:账号|帖子|长推|文章|主页)/],
  ["douyin-other", /抖音/],
  [
    "video",
    /动画|样片|分镜|剧本|配乐|声线|歌词|副歌|说唱|试听|视频脚本|短视频|伤感女声|音频|Suno/i,
  ],
  ["invest", /长桥|美股|港股|核心股|投资|TradePilot|Exness|黄金行情|交易研究/i],
  ["company", /公司|飞书|劳动合同|租金|办公室|绩效|报销|发票|组织调整/],
  ["client", /客户|报价|海报|游戏美术|主图|电商视觉|角色材质|交付边界/],
  ["product", /网站|试衣|产品方向|创意产品|淘宝|闲鱼|批量生图/],
  ["content-other", /专栏|爆火|选题|自媒体/],
  ["t3", /\bT3\b|t3\s|^t3|侧栏|工作台/i],
  ["devices", /磁盘|硬盘|网盘|VPN|WiFi|代理|电脑|服务器|VPS|MacBook|网速|弹窗|手机卡顿/i],
  ["models", /Claude|Codex|Gemini|GPT|OpenAI|DeepSeek|Grok|模型|token|额度|账号停用|LibTV|发布会/i],
  ["automation", /Obsidian|Skill|自动化|Agent|知识|定时|复盘|回顾|语音灵感/i],
];
const PROJECT_FALLBACK: ReadonlyArray<readonly [RegExp, string]> = [
  [/自媒体|公众号|小岛/, "content-other"],
  [/交易|生财/, "invest"],
  [/公司/, "company"],
  [/电商/, "client"],
  [/AI\s*工作台|模型|Codex|Claude/i, "tools-other"],
];

/** Generated prompts and image dumps carry no topic: they wait for a human decision. */
function untitled(title: string) {
  const value = title.trim();
  return (
    value === "" ||
    value.startsWith("<image") ||
    value.startsWith("[external unsupported") ||
    value.startsWith("Call your built-in")
  );
}

export function classifyThread(input: {
  readonly title: string;
  readonly projectName: string | null | undefined;
}): string {
  const title = input.title ?? "";
  if (!untitled(title)) for (const [id, pattern] of TITLE_RULES) if (pattern.test(title)) return id;
  const project = input.projectName ?? "";
  if (untitled(title)) return UNSORTED_CATEGORY_ID;
  for (const [pattern, id] of PROJECT_FALLBACK) if (pattern.test(project)) return id;
  return UNSORTED_CATEGORY_ID;
}

const STORAGE_KEY = "t3code:thread-categories:v1";
type Overrides = Readonly<Record<string, string>>;
const EMPTY: Overrides = {};
let cachedRaw: string | null | undefined;
let cached: Overrides = EMPTY;
const listeners = new Set<() => void>();

export function parseCategoryOverrides(raw: string | null): Overrides {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && CATEGORY_BY_ID.has(entry[1]),
      ),
    );
  } catch {
    return EMPTY;
  }
}
function read(): Overrides {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* Storage unavailable: automatic categories still apply. */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseCategoryOverrides(raw);
  }
  return cached;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function useThreadCategoryOverrides(): Overrides {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
/** A manual choice is final: automatic rules never move that thread again. */
export function setThreadCategory(threadKey: string, categoryId: string | null): boolean {
  const next: Record<string, string> = { ...read() };
  if (categoryId === null) delete next[threadKey];
  else next[threadKey] = categoryId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}
export function resolveThreadCategory(
  overrides: Overrides,
  threadKey: string,
  input: Parameters<typeof classifyThread>[0],
): string {
  return overrides[threadKey] ?? classifyThread(input);
}

export const CATEGORY_PROJECT_KEY_PREFIX = "thread-category:";
export function isCategoryProjectKey(projectKey: string): boolean {
  return projectKey.startsWith(CATEGORY_PROJECT_KEY_PREFIX);
}

/** The category picker is opened from the thread context menu. */
let pickerTarget: { threadKey: string; title: string } | null = null;
const pickerListeners = new Set<() => void>();
export function openThreadCategoryPicker(target: { threadKey: string; title: string } | null) {
  pickerTarget = target;
  pickerListeners.forEach((listener) => listener());
}
export function useThreadCategoryPicker() {
  return useSyncExternalStore(
    (listener) => {
      pickerListeners.add(listener);
      return () => pickerListeners.delete(listener);
    },
    () => pickerTarget,
    () => null,
  );
}
