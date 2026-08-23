import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForWorkspaceByPath,
  type DesktopHarness,
} from "../helpers/electron-app";

async function catalogDump(userDataDir: string): Promise<string> {
  try {
    return await readFile(join(userDataDir, "catalogs.json"), "utf8");
  } catch {
    return "<missing>";
  }
}

async function workspacePresent(window: Page, workspacePath: string): Promise<boolean> {
  const state = await getDesktopState(window);
  return state.workspaces.some((entry) => entry.path === workspacePath);
}

async function removeSelectedWorkspace(window: Page, workspacePath: string): Promise<void> {
  const name = basename(workspacePath);
  await window.getByRole("button", { name: `工作区操作：${name}` }).click();
  const menu = window.locator(".workspace-menu").last();
  await expect(menu.getByRole("button", { name: "移除", exact: true })).toBeVisible();
  window.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await menu.getByRole("button", { name: "移除", exact: true }).click();
}

test("repro: removing the only workspace with a single thread (does it come back?)", async () => {
  test.setTimeout(180_000);
  const userDataDir = await makeUserDataDir("remove-repro-");
  const workspacePath = await makeWorkspace("remove-repro");

  let harness: DesktopHarness | undefined;
  try {
    harness = await launchDesktop(userDataDir, {
      initialWorkspaces: [workspacePath],
      testMode: "background",
    });
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);
    await createNamedThread(window, "唯一对话");

    // Phase 1: wait for the single thread to be present, then remove the workspace.
    const stateBefore = await getDesktopState(window);
    const wsBefore = stateBefore.workspaces.find((entry) => entry.path === workspacePath);
    expect(wsBefore?.sessions.length).toBe(1);
    console.log(`[repro] catalog before remove:\n${await catalogDump(userDataDir)}`);

    await removeSelectedWorkspace(window, workspacePath);

    // Phase 2: does it disappear, and does it come back within this run?
    await expect
      .poll(async () => workspacePresent(window, workspacePath), { timeout: 20_000, message: "workspace should disappear after remove" })
      .toBe(false);
    console.log(`[repro] catalog right after remove:\n${await catalogDump(userDataDir)}`);

    let cameBackDuringRun = false;
    for (let i = 0; i < 10; i++) {
      await window.waitForTimeout(1_500);
      if (await workspacePresent(window, workspacePath)) {
        cameBackDuringRun = true;
        break;
      }
    }
    console.log(`[repro] cameBackDuringRun=${cameBackDuringRun}`);
    console.log(`[repro] catalog after 15s idle:\n${await catalogDump(userDataDir)}`);

    // Phase 3: window focus reconcile.
    await harness.focusWindow();
    await window.waitForTimeout(3_000);
    const cameBackAfterFocus = await workspacePresent(window, workspacePath);
    console.log(`[repro] cameBackAfterFocus=${cameBackAfterFocus}`);
  } finally {
    await harness?.close();
  }

  // Phase 4: restart with the same user data dir.
  const second = await launchDesktop(userDataDir, { testMode: "background" });
  try {
    const window = await second.firstWindow();
    await window.waitForTimeout(5_000);
    const cameBackAfterRestart = await workspacePresent(window, workspacePath);
    console.log(`[repro] cameBackAfterRestart=${cameBackAfterRestart}`);
    console.log(`[repro] catalog after restart:\n${await catalogDump(userDataDir)}`);
    expect(cameBackAfterRestart).toBe(false);
  } finally {
    await second.close();
  }
});
