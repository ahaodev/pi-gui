import type { RuntimeExtensionRecord } from "@pi-gui/session-driver/runtime-types";

export function extensionSourceSummary(extension: RuntimeExtensionRecord): string {
  return `${extensionScopeLabel(extension)} · ${extension.sourceInfo.origin}`;
}

export function extensionScopeLabel(extension: RuntimeExtensionRecord): string {
  if (extension.sourceInfo.source === "builtin" && extension.sourceInfo.origin === "top-level") {
    return "内置";
  }
  switch (extension.sourceInfo.scope) {
    case "project":
      return "项目";
    case "user":
      return "用户";
    default:
      return extension.sourceInfo.scope;
  }
}
