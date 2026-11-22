import { uiText } from "~/i18n";
import type { PullRequestInvolvement, PullRequestListState } from "@t3tools/contracts";
import {
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  ClockIcon,
  EyeIcon,
  LayersIcon,
  ListChecksIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenLineIcon,
  UserLockIcon,
} from "lucide-react";

import type { PullRequestFilterOption } from "./PullRequestListFilters";
import type { PullRequestListSort } from "./pullRequestListPreferences";
import { PullRequestGlyph } from "./pullRequestIcons";

export const INVOLVEMENT_TABS = [
  {
    value: "all",
    get label() {
      return uiText("All");
    },
    Icon: LayersIcon,
  },
  {
    value: "reviewing",
    get label() {
      return uiText("Reviewing");
    },
    Icon: EyeIcon,
  },
  {
    value: "authored",
    get label() {
      return uiText("Authored");
    },
    Icon: PenLineIcon,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestInvolvement>>;

export const STATE_TABS = [
  {
    value: "all",
    get label() {
      return uiText("All");
    },
    Icon: LayersIcon,
  },
  {
    value: "open",
    get label() {
      return uiText("Open");
    },
    Icon: PullRequestGlyph.pullRequest,
  },
  {
    value: "closed",
    get label() {
      return uiText("Closed");
    },
    Icon: PullRequestGlyph.closed,
  },
  {
    value: "merged",
    get label() {
      return uiText("Merged");
    },
    Icon: PullRequestGlyph.merged,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListState>>;

export const SORT_OPTIONS = [
  {
    value: "ready",
    get label() {
      return uiText("Merge readiness");
    },
    Icon: ListChecksIcon,
  },
  {
    value: "blocked",
    get label() {
      return uiText("Blocked on me");
    },
    Icon: UserLockIcon,
  },
  {
    value: "updated",
    get label() {
      return uiText("Recently updated");
    },
    Icon: ClockIcon,
  },
  {
    value: "newest",
    get label() {
      return uiText("Newest shown");
    },
    Icon: CalendarArrowDownIcon,
  },
  {
    value: "oldest",
    get label() {
      return uiText("Oldest shown");
    },
    Icon: CalendarArrowUpIcon,
  },
  {
    value: "largest",
    get label() {
      return uiText("Largest shown");
    },
    Icon: Maximize2Icon,
  },
  {
    value: "smallest",
    get label() {
      return uiText("Smallest shown");
    },
    Icon: Minimize2Icon,
  },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListSort>>;
