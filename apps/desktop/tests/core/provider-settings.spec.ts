import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  stubNextOpenDialog,
} from "../helpers/electron-app";

test("settings lets the user save an API key for a built-in provider", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("provider-settings-api-key-workspace");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: ["openai/gpt-5", "openai/gpt-4o"],
  });

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await window.getByRole("button", { name: "供应商", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("供应商");

    const allProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "全部供应商" }),
    });
    await allProviders.locator(".settings-disclosure__summary").click();
    const openAiRow = allProviders.locator(".settings-row", {
      has: window.locator(".settings-row__title", { hasText: /^openai$/ }),
    });
    await expect(openAiRow).toContainText("API 密钥");
    await openAiRow.getByRole("button", { name: "设置 API 密钥" }).click();

    const dialog = window.getByTestId("provider-api-key-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("openai 的 API 密钥").fill("test-openai-key");
    await dialog.getByRole("button", { name: "设置 API 密钥" }).click();
    await expect(dialog).toHaveCount(0);

    const connectedProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已连接" }),
    });
    await expect(connectedProviders).toContainText("openai");
    await expect(connectedProviders).toContainText("API 密钥");
    await expect(connectedProviders.getByRole("button", { name: "管理", exact: true })).toBeVisible();

    await window.getByRole("button", { name: "模型", exact: true }).click();
    const enabledModels = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已启用模型" }),
    });
    await expect(enabledModels).toContainText("openai/gpt-5");
    await expect(enabledModels).toContainText("openai/gpt-4o");
  } finally {
    await harness.close();
  }
});

test("settings shows environment-configured providers as managed externally", async () => {
  test.setTimeout(60_000);
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-openai-env-key";

  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("provider-settings-env-workspace");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: ["openai/gpt-5"],
  });

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await window.getByRole("button", { name: "供应商", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("供应商");

    const connectedProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已连接" }),
    });
    const openAiRow = connectedProviders.locator(".settings-row", {
      has: window.locator(".settings-row__title", { hasText: /^openai$/ }),
    });
    await expect(openAiRow).toContainText("环境变量");
    await expect(openAiRow.locator(".settings-row__control")).toHaveCount(0);
  } finally {
    await harness.close();
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }
  }
});

test("settings keeps models.json provider overrides in the external-config state", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("provider-settings-models-json-workspace");
  await seedAgentDir(agentDir, {
    withOpenAiAuth: false,
    withDefaultModel: false,
    enabledModels: ["openai/gpt-5"],
  });
  await writeFile(
    join(agentDir, "models.json"),
    `${JSON.stringify(
      {
        providers: {
          openai: {
            apiKey: "test-openai-models-json-key",
            baseUrl: "https://api.openai.com/v1",
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await window.keyboard.press(desktopShortcut(","));
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await window.getByRole("button", { name: "供应商", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("供应商");

    const connectedProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已连接" }),
    });
    const openAiRow = connectedProviders.locator(".settings-row", {
      has: window.locator(".settings-row__title", { hasText: /^openai$/ }),
    });
    await expect(openAiRow).toContainText("外部配置");
    await expect(openAiRow.locator(".settings-row__control")).toHaveCount(0);

    const customEndpoints = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "自定义端点" }),
    });
    await expect(customEndpoints).toContainText("还没有自定义端点。");
    await expect(
      customEndpoints.locator(".settings-row", {
        has: window.locator(".settings-row__title", { hasText: /^openai$/ }),
      }),
    ).toHaveCount(0);
  } finally {
    await harness.close();
  }
});

test("opening the first workspace from the empty state hydrates provider and model settings without refresh", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("provider-settings-first-workspace");
  await seedAgentDir(agentDir, {
    enabledModels: ["openai/gpt-5", "openai/gpt-4o"],
  });

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const emptyState = window.getByTestId("empty-state");
    await expect(emptyState).toBeVisible();

    await stubNextOpenDialog(harness, [workspacePath]);
    await emptyState.getByRole("button", { name: "打开第一个文件夹" }).click();

    await expect(emptyState).toHaveCount(0);
    await expect(window.getByTestId("workspace-list")).toContainText("provider-settings-first-workspace");
    await expect(window.getByTestId("new-thread-composer")).toBeVisible();

    await window.keyboard.press(desktopShortcut(","));
    const settingsSurface = window.getByTestId("settings-surface");
    await expect(settingsSurface).toBeVisible();
    await expect(settingsSurface.getByRole("button", { name: "刷新", exact: true })).toHaveCount(0);

    await window.getByRole("button", { name: "供应商", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("供应商");

    const connectedProviders = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已连接" }),
    });
    await expect(connectedProviders).toContainText("openai");
    await expect(connectedProviders).toContainText("API 密钥");

    await window.getByRole("button", { name: "模型", exact: true }).click();
    await expect(window.locator(".view-header__title")).toHaveText("模型");

    const enabledModels = window.locator(".settings-section", {
      has: window.locator(".settings-section__title", { hasText: "已启用模型" }),
    });
    await expect(enabledModels).toContainText("openai/gpt-5");
    await expect(enabledModels).toContainText("openai/gpt-4o");
  } finally {
    await harness.close();
  }
});
