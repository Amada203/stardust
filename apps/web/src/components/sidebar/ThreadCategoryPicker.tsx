import { XIcon } from "lucide-react";
import {
  THREAD_CATEGORIES,
  THREAD_CATEGORY_GROUPS,
  openThreadCategoryPicker,
  setThreadCategory,
  useThreadCategoryOverrides,
  useThreadCategoryPicker,
} from "../../threadCategories";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogPopup, DialogTitle } from "../ui/dialog";
import { toastManager } from "../ui/toast";

/** Manual category choice for one conversation; stored on this machine only. */
export function ThreadCategoryPickerDialog() {
  const target = useThreadCategoryPicker();
  const overrides = useThreadCategoryOverrides();
  const current = target ? overrides[target.threadKey] : undefined;
  const choose = (categoryId: string | null) => {
    if (!target) return;
    if (!setThreadCategory(target.threadKey, categoryId))
      toastManager.add({ type: "error", title: "分类没有保存，请检查本机存储空间" });
    openThreadCategoryPicker(null);
  };
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && openThreadCategoryPicker(null)}>
      <DialogPopup showCloseButton={false}>
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle>调整分类</DialogTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{target?.title}</p>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="关闭" />}>
              <XIcon />
            </DialogClose>
          </div>
          <div className="max-h-[min(60vh,520px)] space-y-3 overflow-y-auto">
            {THREAD_CATEGORY_GROUPS.map((group) => (
              <section key={group} aria-label={group}>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">{group}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {THREAD_CATEGORIES.filter((category) => category.group === group).map(
                    (category) => (
                      <Button
                        key={category.id}
                        size="xs"
                        variant={current === category.id ? "default" : "outline"}
                        aria-pressed={current === category.id}
                        onClick={() => choose(category.id)}
                      >
                        {category.label}
                      </Button>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              手动选的分类不会被自动规则改掉；会话本身和所属项目不变。
            </p>
            {current ? (
              <Button size="xs" variant="ghost" onClick={() => choose(null)}>
                恢复自动归类
              </Button>
            ) : null}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
