import { expect, test, type Page } from "@playwright/test";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

async function expectTerminalAndChangesSplit(window: Page): Promise<void> {
  const terminal = window.getByTestId("integrated-terminal");
  const diffPanel = window.locator(".diff-panel");

  await expect(terminal).toBeVisible();
  await expect(diffPanel).toBeVisible();

  const terminalBox = await terminal.boundingBox();
  const diffPanelBox = await diffPanel.boundingBox();
  expect(terminalBox).not.toBeNull();
  expect(diffPanelBox).not.toBeNull();
  if (!terminalBox || !diffPanelBox) {
    throw new Error("Expected terminal and changes panel boxes");
  }

  expect(terminalBox.x + terminalBox.width).toBeLessThanOrEqual(diffPanelBox.x + 1);
  expect(diffPanelBox.y + diffPanelBox.height).toBeGreaterThanOrEqual(terminalBox.y + terminalBox.height - 1);
  expect(diffPanelBox.width).toBeGreaterThanOrEqual(320);
  expect(terminalBox.width).toBeGreaterThan(300);
}

test("keeps Changes visible when the integrated terminal is open and maximized", async () => {
  test.setTimeout(45_000);

  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("terminal-diff-layout");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);
    await createNamedThread(window, "Terminal and Changes layout");

    await window.getByLabel("切换变更").click();
    const diffPanel = window.locator(".diff-panel");
    await expect(diffPanel.locator(".diff-panel__title")).toContainText("变更");

    await window.getByLabel("切换终端").click();
    await expectTerminalAndChangesSplit(window);

    const beforeTakeover = await window.getByTestId("integrated-terminal").boundingBox();
    await window.getByLabel("最大化终端").click();
    await expect(window.getByTestId("integrated-terminal")).toHaveClass(/terminal-panel--takeover/);
    await expect(window.getByTestId("composer")).toHaveCount(0);
    await expectTerminalAndChangesSplit(window);

    const takeover = await window.getByTestId("integrated-terminal").boundingBox();
    expect(takeover?.height ?? 0).toBeGreaterThan(beforeTakeover?.height ?? 0);

    await window.getByLabel("还原终端").click();
    await expect(window.getByTestId("integrated-terminal")).not.toHaveClass(/terminal-panel--takeover/);
    await expect(window.getByTestId("composer")).toBeVisible();
    await expectTerminalAndChangesSplit(window);
  } finally {
    await harness.close();
  }
});
