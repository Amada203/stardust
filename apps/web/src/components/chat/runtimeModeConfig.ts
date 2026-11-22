import {
  managedRuntimeModeDenial,
  type ManagedPolicySummary,
  type RuntimeMode,
} from "@t3tools/contracts";
import { PenLineIcon, ShieldOffIcon } from "lucide-react";
import { createElement, type ComponentType, type SVGProps } from "react";

export type RuntimeModeIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function PermissionApprovalIcon(props: SVGProps<SVGSVGElement>) {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("path", {
      d: "M12 3 5.5 5.8v5.5c0 4.3 2.8 7.8 6.5 9.2 3.7-1.4 6.5-4.9 6.5-9.2V5.8L12 3Z",
    }),
    createElement("path", { d: "M9.5 11.8l1.8 1.8 3.6-3.8" }),
  );
}

function PermissionAutoIcon(props: SVGProps<SVGSVGElement>) {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.65,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("path", { d: "M12 3a9 9 0 1 0 9 9" }),
    createElement("path", { d: "M13 7.5 9.5 13h4l-1.5 4.5" }),
    createElement("path", {
      d: "M17.5 3.5 18.2 5.3 20 6l-1.8.7-.7 1.8-.7-1.8L15 6l1.8-.7.7-1.8Z",
    }),
  );
}

export const runtimeModeConfig: Record<
  RuntimeMode,
  { label: string; description: string; icon: RuntimeModeIconComponent }
> = {
  "approval-required": {
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: PermissionApprovalIcon,
  },
  "auto-accept-edits": {
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  auto: {
    label: "Auto",
    description: "Supported providers approve routine actions; others still ask.",
    icon: PermissionAutoIcon,
  },
  "full-access": {
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    // An open lock reads like a closed one at small sizes; a crossed shield does not.
    icon: ShieldOffIcon,
  },
};

export const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];

/** The modes a provider supports (all when it reports none) and the mode a thread really runs in. */
export function resolveCompatibleRuntimeMode(
  runtimeMode: RuntimeMode,
  supportedRuntimeModes: ReadonlyArray<RuntimeMode> | undefined,
) {
  const modes =
    supportedRuntimeModes && supportedRuntimeModes.length > 0
      ? runtimeModeOptions.filter((mode) => supportedRuntimeModes.includes(mode))
      : runtimeModeOptions;
  return { modes, mode: modes.includes(runtimeMode) ? runtimeMode : (modes[0] ?? runtimeMode) };
}

export function resolveRuntimeModeOptions(
  modes: ReadonlyArray<RuntimeMode>,
  managedPolicy: ManagedPolicySummary | undefined,
) {
  return modes.map((mode) => {
    const option = { mode, ...runtimeModeConfig[mode] };
    const disabledReason = managedRuntimeModeDenial(managedPolicy, mode);
    return disabledReason === undefined ? option : { ...option, disabledReason };
  });
}
