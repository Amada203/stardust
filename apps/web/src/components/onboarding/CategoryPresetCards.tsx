import {
  DEFAULT_SIDEBAR_CATEGORY_SETTINGS,
  type SidebarCategoryPreset,
} from "@t3tools/contracts/settings";
import { categoryDefinitions, SIDEBAR_CATEGORY_PRESETS } from "../../threadCategories";
import { useUiText } from "~/i18n/useUiText";
import { cn } from "~/lib/utils";

export function CategoryPresetCards({
  preset,
  onChange,
}: {
  readonly preset: SidebarCategoryPreset;
  readonly onChange: (preset: SidebarCategoryPreset) => void;
}) {
  const text = useUiText();
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {(Object.keys(SIDEBAR_CATEGORY_PRESETS) as SidebarCategoryPreset[]).map((id) => {
        const selected = preset === id;
        const definition = SIDEBAR_CATEGORY_PRESETS[id];
        const labels =
          id === "project"
            ? ["Project A", "Project B", "Threads without a project"]
            : categoryDefinitions({ ...DEFAULT_SIDEBAR_CATEGORY_SETTINGS, preset: id }).map(
                (category) => category.label,
              );
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            data-category-preset={id}
            onClick={() => onChange(id)}
            className={cn(
              "relative grid min-h-36 content-start gap-2 rounded-xl border bg-card p-4 pr-8 text-left outline-primary transition-colors duration-200 motion-reduce:transition-none",
              selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50",
            )}
          >
            <span className="flex flex-wrap items-center gap-2 text-stardust-card font-semibold">
              {text(definition.label)}
              {id === "general" ? (
                <span className="rounded-full bg-primary/10 px-2 text-xs text-primary">
                  {text("Recommended")}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-muted-foreground">{text(definition.description)}</span>
            <span className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                >
                  {text(label)}
                </span>
              ))}
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute top-4 right-4 size-4 rounded-full border",
                selected ? "border-4 border-primary" : "border-muted-foreground/60",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
