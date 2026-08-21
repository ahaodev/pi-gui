import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  getApplicationMenuItemInfo,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

test("installs the Chinese application menu and window title", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("application-menu");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    // The window title comes from the static <title> in index.html (the
    // renderer never overrides document.title), so assert parity against
    // the source file rather than pinning a specific brand name.
    const sourceTitle = /<title>([^<]*)<\/title>/
      .exec(readFileSync(join(__dirname, "../../index.html"), "utf8"))?.[1]
      .trim();
    expect(sourceTitle, "Expected a non-empty <title> in index.html").toBeTruthy();
    expect(await window.title()).toBe(sourceTitle);

    const { appName, menu } = await harness.electronApp.evaluate(({ Menu, app }) => {
      const root = Menu.getApplicationMenu();
      if (!root) {
        return { appName: app.name, menu: null };
      }
      const walk = (
        items: typeof root.items,
      ): Array<{ label: string; children: Array<ReturnType<typeof walk>> }> =>
        items.map((item) => ({
          label: item.label,
          children: item.submenu ? walk(item.submenu.items) : [],
        }));
      return { appName: app.name, menu: walk(root.items) };
    });

    expect(menu, "Expected an application menu to be installed").not.toBeNull();
    if (!menu) {
      return;
    }

    const isMac = process.platform === "darwin";
    const topLabels = menu.map((entry) => entry.label);
    if (isMac) {
      expect(topLabels[0]).toBe(appName);
      expect(topLabels.slice(1)).toEqual(["文件", "编辑", "视图", "窗口"]);
    } else {
      expect(topLabels).toEqual(["文件", "编辑", "视图", "窗口"]);
    }

    const labelsOf = (name: string) =>
      menu.find((entry) => entry.label === name)?.children.map((child) => child.label) ?? [];

    expect(labelsOf("文件")).toContain("新建窗口");
    expect(labelsOf("文件")).toContain("打开文件夹…");
    expect(labelsOf("编辑")).toEqual(
      expect.arrayContaining(["撤销", "重做", "剪切", "复制", "粘贴", "删除", "全选"]),
    );
    expect(labelsOf("视图")).toEqual(
      expect.arrayContaining(["重新加载", "强制重新加载", "切换开发者工具", "实际大小", "放大", "缩小", "切换全屏"]),
    );
    expect(labelsOf("窗口")).toEqual(expect.arrayContaining(["最小化", "缩放"]));

    const menuLabels = isMac ? topLabels.slice(1) : topLabels;
    expect(menuLabels.every((label) => /[一-鿿]/.test(label)), `Expected Chinese top-level labels, got: ${menuLabels.join(", ")}`).toBe(true);

    expect(await getApplicationMenuItemInfo(harness, "file.new-window")).toMatchObject({
      label: "新建窗口",
      parentLabel: "文件",
    });
    expect(await getApplicationMenuItemInfo(harness, "file.open-folder")).toMatchObject({
      label: "打开文件夹…",
      parentLabel: "文件",
    });
  } finally {
    await harness.close();
  }
});
