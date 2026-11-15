import type { ProviderApprovalDecision } from "@t3tools/contracts";
import type { ThreadPendingApproval } from "@t3tools/client-runtime/state/thread-requests";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { TaskProgressSnapshot } from "./taskProgress";

export function approvalPresentation(approval: ThreadPendingApproval) {
  const detail = approval.detail?.trim() ?? "";
  const destructive =
    /\b(rm|rmdir|sudo|chmod|chown|mkfs|diskutil|truncate)\b|\bgit\s+(reset\s+--hard|clean)\b/i.test(
      detail,
    );
  const network =
    /\b(npm|pnpm|yarn|bun|pip|pip3|uv|brew)\s+(add|install|update|upgrade|sync)\b|\b(curl|wget)\b/i.test(
      detail,
    );
  const outside = /outside (?:the )?workspace|工作区(?:以)?外/i.test(approval.reason ?? "");
  const title =
    outside && approval.requestKind === "file-change"
      ? "想写入工作区以外的文件夹"
      : approval.requestKind === "file-change"
        ? "想修改文件"
        : approval.requestKind === "file-read"
          ? "想读取文件"
          : approval.requestKind === "command"
            ? network
              ? "想联网安装依赖或访问网络"
              : "想运行一条命令"
            : "请求工具使用许可";
  // Only a bare, known read command earns a low-risk label; shell syntax stays unclassified.
  const readOnly =
    /^(pwd|ls|cat|head|tail|wc|stat)(?:\s+[\w./ -]+)?$/.test(detail) && !/[\n\r]/.test(detail);
  const risk =
    destructive || outside
      ? "删除或越权 · 高风险"
      : network
        ? "联网或改依赖 · 需留意"
        : approval.requestKind === "file-change"
          ? "会写文件 · 中风险"
          : approval.requestKind === "file-read" || readOnly
            ? "只读 · 低风险"
            : null;
  const summary = (detail || approval.appName || title).replace(/\s+/g, " ").slice(0, 100);
  return { title, risk, summary, detail };
}

export function approvalResultLabel(decision: ProviderApprovalDecision) {
  switch (decision) {
    case "accept":
      return "✓ 已批准（仅这一次）";
    case "acceptForSession":
      return "✓ 已批准（本会话同类不再问）";
    case "acceptAlways":
      return "✓ 已批准（始终允许）";
    case "decline":
      return "✕ 已拒绝";
    case "cancel":
      return "✕ 已取消";
  }
}

export function trailApprovalResults(
  projection: ThreadStructure | null,
  progress: TaskProgressSnapshot,
) {
  const plan = projection?.plans.find((entry) => entry.id === progress.planId);
  if (!projection || !plan) return [];
  const requestIds = new Set(
    projection.turnItems
      .filter(
        (item) =>
          item.type === "approval_request" &&
          item.runId === plan.runId &&
          (plan.runId !== null || item.nodeId === plan.nodeId),
      )
      .map((item) => (item.type === "approval_request" ? item.requestId : "")),
  );
  return projection.runtimeRequests.flatMap((request) =>
    request.status === "resolved" && request.decision && requestIds.has(request.id)
      ? [{ requestId: request.id, decision: request.decision }]
      : [],
  );
}
