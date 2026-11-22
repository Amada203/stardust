import { uiText } from "~/i18n";
import { lucideIconNames } from "./lib/lucideIconByName";
export { PROJECT_ICON_COLORS, projectIconColorClassName } from "./projectIconColors";

const POPULAR_PROJECT_ICONS: ReadonlyArray<string> = [
  "folder-code",
  "code-2",
  "terminal",
  "globe-2",
  "server",
  "database",
  "bot",
  "sparkles",
  "smartphone",
  "monitor",
  "cloud-cog",
  "package",
  "book-open",
  "flask-conical",
  "shield-check",
  "rocket",
  "gamepad-2",
  "music",
  "image",
  "shopping-bag",
  "git-branch",
  "workflow",
  "wrench",
  "layers-3",
];

export const PROJECT_EMOJIS: ReadonlyArray<{ readonly emoji: string; readonly label: string }> = [
  {
    emoji: "💻",
    get label() {
      return uiText("Computer");
    },
  },
  {
    emoji: "🛠️",
    get label() {
      return uiText("Tools");
    },
  },
  {
    emoji: "🚀",
    get label() {
      return uiText("Rocket");
    },
  },
  {
    emoji: "🤖",
    get label() {
      return uiText("Robot");
    },
  },
  {
    emoji: "✨",
    get label() {
      return uiText("Sparkles");
    },
  },
  {
    emoji: "⚡",
    get label() {
      return uiText("Lightning");
    },
  },
  {
    emoji: "🌐",
    get label() {
      return uiText("Web");
    },
  },
  {
    emoji: "📱",
    get label() {
      return uiText("Mobile");
    },
  },
  {
    emoji: "🖥️",
    get label() {
      return uiText("Desktop");
    },
  },
  {
    emoji: "⌨️",
    get label() {
      return uiText("Keyboard");
    },
  },
  {
    emoji: "⚙️",
    get label() {
      return uiText("Gear");
    },
  },
  {
    emoji: "🗄️",
    get label() {
      return uiText("Database");
    },
  },
  {
    emoji: "☁️",
    get label() {
      return uiText("Cloud");
    },
  },
  {
    emoji: "📦",
    get label() {
      return uiText("Package");
    },
  },
  {
    emoji: "📚",
    get label() {
      return uiText("Books");
    },
  },
  {
    emoji: "🧪",
    get label() {
      return uiText("Test tube");
    },
  },
  {
    emoji: "🔒",
    get label() {
      return uiText("Lock");
    },
  },
  {
    emoji: "🎮",
    get label() {
      return uiText("Game");
    },
  },
  {
    emoji: "🎵",
    get label() {
      return uiText("Music");
    },
  },
  {
    emoji: "🎬",
    get label() {
      return uiText("Movie");
    },
  },
  {
    emoji: "🖼️",
    get label() {
      return uiText("Picture");
    },
  },
  {
    emoji: "🛍️",
    get label() {
      return uiText("Shopping");
    },
  },
  {
    emoji: "🔥",
    get label() {
      return uiText("Fire");
    },
  },
  {
    emoji: "💡",
    get label() {
      return uiText("Idea");
    },
  },
  {
    emoji: "🧩",
    get label() {
      return uiText("Puzzle");
    },
  },
  {
    emoji: "📊",
    get label() {
      return uiText("Chart");
    },
  },
  {
    emoji: "🧠",
    get label() {
      return uiText("Brain");
    },
  },
  {
    emoji: "🦄",
    get label() {
      return uiText("Unicorn");
    },
  },
  {
    emoji: "🐙",
    get label() {
      return uiText("Octopus");
    },
  },
  {
    emoji: "🌱",
    get label() {
      return uiText("Seedling");
    },
  },
];

export function filterProjectIconNames(query: string): ReadonlyArray<string> {
  const normalized = query.trim().toLowerCase().replaceAll(/\s+/g, "-");
  if (!normalized) return POPULAR_PROJECT_ICONS;
  return lucideIconNames.filter((name) => name.includes(normalized)).slice(0, 60);
}

export function firstEmoji(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed);
  const segment = segments[Symbol.iterator]().next().value?.segment;
  const isFlag = /^\p{Regional_Indicator}{2}$/u.test(segment ?? "");
  const isKeycap = /^[#*0-9]\uFE0F?\u20E3$/u.test(segment ?? "");
  if (!segment || (!/\p{Extended_Pictographic}/u.test(segment) && !isFlag && !isKeycap)) {
    return null;
  }
  return segment;
}
