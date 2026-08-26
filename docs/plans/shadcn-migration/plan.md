# apps/desktop → shadcn/ui 全面迁移计划（Codex-style desktop）

## 目标

把 `../../../apps/desktop` 的所有页面/表面从手写的 CSS 类迁移到 shadcn/ui 组件 +
Tailwind v4 原子类，使 `src/styles/*` 中重复的组件样式大幅收缩，只保留
真正的全局样式（tokens、reset、主题切换、markdown prose、xterm 等第三方）。

## 背景事实（调研结论）

- `../../../apps/desktop` 已有 shadcn 初始化：Tailwind v4、`new-york` 风格、radix 底座、
  lucide 图标，25 个组件已装（见 `components.json`、`src/lib/utils.ts` 的 `cn()`）。
- `sidebar.tsx` / `topbar.tsx` 已是 shadcn + 原子类的样板（2026-07 的
  d6b5dbe 提交），本计划把它们当作"完成态"的参考，而不是要改的东西。
- `../../../apps/website` 是 Next.js 营销站，无 shadcn 配置，不属于本次"页面"迁移范围
  （如需可另立计划）。

## 关键约束

1. **测试选择器契约**：484 处按 CSS 类、451 处按 `data-testid` 定位。迁移时
   保留 `data-testid` 与被测试强依赖的类名（如 `.settings-row`、
   `.theme-preset-card--active`、`.view-header`、`.surface-toolbar__field select`
   必须是原生 `<select>` 且 `toHaveValue`、`label.settings-toggle` 内必须是原生
   `input[type=checkbox]`、`.settings-disclosure` 必须是 `details/summary`、
   `.settings-select` 必须是原生 select）。能用 shadcn 组件的地方换，
   测试绑死原生控件的地方保留原生控件外观但用原子类重排。
2. **主题联动**：主题预设通过 `--theme-*` 内联变量切换，shadcn 的语义 token
   已在 `src/styles/shadcn.css` 里桥接到 `--theme-*`/`--surface`/`--line` 等，
   迁移后必须保持"换主题预设即全站变色"的能力。
3. **级联契约**：`shadcn.css` 先加载（未分层 Tailwind 主题变量 + 分层 utilities），
   随后是 app 的未分层 CSS。Tailwind v4 原子类在 `@layer utilities`（低优先级），
   未分层的 app CSS 会压过原子类。因此**每迁移一块 DOM，就要在同一提交里删掉
   对应的 app CSS 规则**，否则原子类不生效、样式重复。
4. **Electron 渲染进程**：保持 renderer 不碰 Node；所有改动在
   `../../../apps/desktop/src` 内。
5. **视觉回归**：每个表面迁移后跑对应 playwright spec（`PI_APP_TEST_MODE=background`
   跑 core 泳道即可，不必起真实模型），并截图对比关键表面。

## 阶段划分（按表面，每阶段一个可验证提交）

- [x] **P0 — 基线**：typecheck 绿；core 泳道 = 22 failed / 105 passed / 4
      skipped（预先存在：汉化字符串漂移、Linux 环境、timing）。
- [x] **P1 — 设置表面**（commit `bf553c4` + 测试修正 + `25a4961` 迁移）：
      `secondary-surface.tsx`、`settings-view.tsx`、6 个 `settings-*-section.tsx`、
      `settings-utils.tsx`。原语：`Button`/`Input`/`Dialog`/`Switch`/`Checkbox`
      （`settings-toggle` 行保留原生 input）。删除 `.settings-*` 等规则。
      16/16 P1 specs 通过，5 个基线失败修复。
- [x] **P2 — 新建对话页**（commit `74a141a`）：`new-thread-view.tsx`。Hero/
      工作区选择/环境切换 → 原子类；`new-thread.css` 收缩为 2 条
      `.new-thread__composer` 覆写。13/13 P2 specs 通过。
- [x] **P3 — 输入区 Composer**（commits `97df431` P3a + `46ba44b` P3b）。
- [x] **P4 — 会话时间线**（commits `f9175f6` P4a + `ad09cb7` P4b）。
      timeline.css 867→49 行（仅 keyframes + reduced-motion 残留）。
- [x] **P5 — 模态**（commit `28b7b7f`）。tree-modal/fork-modal → utilities
      （保留自定义焦点陷阱/两步 Esc）。main.css -275 行。
- [x] **P6 — 差异面板 + 文件工作台 + 终端**（commit `2b13180`）。
      diff-panel/file-workbench/terminal-panel → utilities；状态色改为互斥
      完整字符串；`.main` 网格定位规则留到 P9。main.css 1224→673 行。
- [x] **P7 — 模型选择器 + 线程搜索**（commit `a8fdbee`）。
      model-selector-panel.css 整删；thread-search-bar 原子化（无 spec 定位）；
      `mark.thread-find-*` 保留 CSS（use-thread-search.ts 程序化设置
      mark.className，原子类会被抹掉）。
- [x] **P8 — 扩展与技能**（`c9a8d7d`）：skills-view + extensions-view +
      extension-session-ui（dock/dialog）全部 utility 化；main.css 231–548 删除。
      skills-settings 2/2 + P8 面 19 通过（仅 4 个已知基线/抖动）。
      注：skills-view 最终版采用 border-strong+overlay-hover 选中态（忠实原 CSS）。
- [x] **P9 — 应用外壳收尾**（`0d4e11d`）：canvas/conversation/chat-header/empty-panel/
      view-header/sr-only/icon-button--active（死）全部原子化；glass 效果 →
      `[.enable-transparency_&]:` 任意变体（topbar/composer/composer__surface/tree+fork
      面板/slash+mention/sidebar/secondary-surface__sidebar）；media 980/700 全部元素化；
      new-thread.css 整删；.icon-button 移 base.css；.meta-chip* 与 .message p 死代码删除。
      main.css 325→126 行（仅 .main 状态机 + placement + marks + overlay），
      sidebar.css 仅 .shell 状态机 + 变量。定向 P9 集 23 过 / 6 败（全为已知基线）；
      glass（settings-appearance:38）✓。全 lane 复跑中：/tmp/p9-fullrun.log（PID 184039）。

## P9 处置细则（原子化 vs 保留）

**原子化（移到元素、删 CSS）**：
- main.css：`.sr-only`（TW 原生 sr-only 已生成）、`.canvas*`×4、`.conversation*`×3、
  `.chat-header*`×5、`.empty-panel*`×3、`.icon-button--active`（→`text-[var(--accent)]`，
  品牌色不能用 TW 的 text-accent）、glass 块（→`[.enable-transparency_&]:backdrop-blur-[var(--glass-blur)]`+
  `backdrop-saturate-[var(--glass-saturation)]`；topbar `!bg-[var(--surface-glass)]`、composer `!bg-transparent`）、
  `.view-header*`×4
- media 980：topbar/composer/canvas `px-[18px]`；topbar/composer__bar/chat-header__row/
  view-header/tree-modal__footer `flex-col items-stretch`；topbar__actions `justify-start`；
  skills-layout/skills-grid 单列（→元素 `max-[980px]:`）
- media 700：settings-row/settings-field__header/skill-detail__header `flex-col` +
  settings-row__actions（→元素）；secondary-surface__content padding（→元素）
- new-thread.css 整删：`.new-thread__composer.composer` padding/bg 规则已死（.composer
  基础规则 P3 已删）；`.conversation--composer { width:100% }` → new-thread 的
  conversation 元素直接 `w-full`（thread 侧元素 `w-[min(927px,100%)]`，各自 JSX 自控）
- base.css：`.meta-chip*`（全仓无引用）、`.message p`（死选择器）
- sidebar.css：`.icon-button` → base.css（与 .button 同类的共享基元，保留）

**保留（布局状态机 + 平台例外，注释说明）**：
- main.css：`.main` grid 状态机 + 子面板 placement（状态在 App，原子化需穿透子组件）
  + media 980 `.main--with-side-panel`/`.diff-panel` + media 700 `.secondary-surface` 列
  + thread-find marks + `[data-slot=dialog-overlay]`
- sidebar.css：`.shell` 状态机 + CSS 变量（--titlebar-toggle-* 被 topbar.css 消费）+ 760 drawer
- topbar.css（Electron 窗口 chrome：no-drag + 变量定位）、timeline.css（keyframes+
  reduced-motion）、syntax-highlight.css（markdown prose）、base.css 其余
  （tokens/reset/.button/.icon-button/.session-header/.loading-card/.empty-state/
  .empty-panel 排版/focus ring）

**radius 安全验证（重要）**：TW 默认 `:root, :host { --radius-lg: .5rem ... }` 在构建产物
靠前（行 374），app tokens `:root { --radius-lg: 10px ... }` 靠后（行 5772+），两者 unlayered
同级 → app 值赢。rounded-md/lg/xl/2xl = 8/10/12/14px ✓ 与 P1–P8 全部映射一致。

## ⚠️ P5–P7 期间发现的两个系统性问题（已修，P8/P9 必须沿用对策）

### 1. 桥接 token 缺失 → 原子类静默不生成
`shadcn.css` 的 `@theme inline` 最初**没有** `--color-surface` /
`--color-surface-muted`，但 P1–P7 大量使用了 `bg-surface` /
`bg-surface-muted`。Tailwind v4 对未知 token 不报错、直接不生成该类 →
这些元素的背景一直缺失（测试不查背景色，全部漏过）。
**已修**：在 shadcn.css 补 `--color-surface: var(--surface)`、
`--color-surface-muted: var(--surface-muted)`。
**对策**：P8/P9 每引入一个新 `*-<token>` 颜色工具类，构建后 grep
`out/renderer/assets/*.css` 确认该类真的生成了（尤其自定义名）。

### 2. 同级原子类按"生成顺序"决胜，覆盖不可靠
两个 specificity 相同的原子类同时出现在一个元素上时，谁赢取决于构建产物里
的行号（与源码顺序无关）。实测排序坑：
- `bg-transparent` / `border-transparent` 排在所有主题色**之后** →
  基础 `bg-transparent` 会压过状态类 `bg-accent-tint-strong`（P5 选中态全灭）。
- shadcn 组件内部类（toggle 的 `rounded-md`/`bg-transparent`/
  `data-[state=on]:bg-accent`、button 的 `text-primary-foreground`/
  `hover:bg-primary/90`、input 的 `border-input`/`shadow-xs`、dialog 的
  `sm:max-w-lg`）会压过我加在 className 上的同属性工具类 →
  P1 的 Dialog 圆角/宽度/gap、Button 文字色（白字浅底，几乎不可见）、
  Toggle pill 的 on 态背景全错。
**已修（两类对策，二选一，不要用"基础类 + 条件类"叠加）**：
- **互斥完整字符串**：状态样式拆成 `cond ? "A 全套" : "B 全套"`，同一属性
  永不共现（tree-modal 选中行、summary 选项、diff 上下文 chip、timeline
  状态点/文字、环境 pill 按钮）。hover/selected 的相对优先级用
  "variant(0,2,0) > plain(0,1,0)" 天然保证。
- **`!` important 后缀**：有意识覆盖 shadcn 组件内部类时用 `rounded-[10px]!`、
  `bg-surface!`、`data-[state=on]:bg-[var(...)]!`（v4 语法 = 结尾 `!`），
  important 恒定胜过非 important，与顺序无关。settings-utils 的三个共享
  class 常量（settingsButtonClass / settingsFieldControlClass /
  settingsPillItemClass）与两个 settings Dialog 已全部加 `!`。
- 另外：shadcn Dialog 的 overlay 是 DialogContent 内部自动渲染、无
  className 入口 → 在 main.css 末尾用未分层规则
  `[data-slot="dialog-overlay"]` 还原原 extension-dialog 遮罩
  （rgba(24,31,44,.26)+blur(6px)）。
- 环境 pill（new-thread/fork）从 shadcn `Toggle` 回退为**普通
  `<button aria-pressed>`**：Toggle 内部类太多无法干净覆盖；spec 只要求
  `getByRole("button",{name})`，普通按钮完全满足且类名 100% 自控。

## 进度检查点（P1+P2 之后）

Core E2E 泳道：**17 failed / 111 passed / 5 skipped**（基线 22/105/4）。
设置类 5 个失败已修复；剩余 17 个为预先存在的 flaky/timing/环境失败
（integrated-terminal、timeline-pinning、tree-command、workspace-menu、
sidebar-toggle、login-prompt、orchestration-runtime-tools、context-rail、
mentions-diff、changed-files、composer-controls、new-thread-auto-title），
每次运行失败的行号会漂移。**迁移未引入新失败。**
P5/P6/P7 分阶段跑：tree-command 2 个基线失败保持；fork-from-message、
thread-menu、changed-files、terminal-diff-layout（原基线失败→现已通过）、
integrated-terminal 3 个基线失败保持；new-thread-composer 6/6、
model-scope-toggle 1/1 通过。
（P5–P7 的系统性修复后的全量 core 泳道正在跑，结果见 /tmp/p567-fullrun.log。）

### 契约经验（后续阶段沿用）

- `data-testid` 和被测试绑死的 hook 类必须保留。
- 测试用 `selectOption`/`input[type=...]`/`toHaveValue` 绑定的控件保持
  原生 `<select>`/`<input>`/`<details>`。
- `getByRole('button')` 的元素必须是真 `<button>`。
- 未删基础 CSS 前，原子类覆写不生效（级联契约第 3 条）。
- **状态色互斥字符串 / 组件内部覆盖用 `!`**（见上"系统性问题 2"）。
- 程序化改 className 的节点（thread-find 的 `<mark>`）只能靠 CSS 规则。
- CSS 里 `var(--depth)` 这类内联变量 → `pl-[calc(10px+var(--depth)*14px)]`。

## 每阶段验证闭环

1. `pnpm run typecheck`（apps/desktop）
2. 跑该阶段对应 specs（`PI_APP_TEST_MODE=background` core 泳道）
3. 全量 CSS 删除后重跑，确认无"删 CSS 即挂"的漏网选择器
4. 截图关键表面（light/dark 各一）对比迁移前
5. 提交（信息写明迁移了哪些表面、删了哪些 CSS 规则、保留哪些测试 hook 类）

## 风险与对策

- **测试选择器漂移**：迁移与删 CSS 同一提交；跑全量 core 泳道兜底。
- **主题预设失效**：shadcn token 已桥接 `--theme-*`；appearance 表面保留
  预设卡片的内联变量写入逻辑不动。
- **级联覆盖**：见"系统性问题 2"，已建立对策。
- **xterm/markdown 等第三方**：不动其 CSS，只把包在外面的容器原子化。

## Final state (complete)

- **P9 app shell done**: main.css 126 lines (`.main` grid state machine, dialog
  overlay, thread-find marks, media 980 main/diff); sidebar.css (`.shell` state
  machine + drawer); new-thread.css deleted; `.icon-button` in base.css; glass
  rules via `[.enable-transparency_&]:` variants; all media 980/700 elementized.
- **Scale fix (54f03a2)**: tokens.css `--text-*` realigned to the standard TW
  scale (12/14/16/18/20/24) — the whole P1-P9 migration had assumed it, while
  the old app scale (11/12/14/16/20/28) won the `:root` cascade and rendered
  every named text utility 1-2px small. Raw `.button` (14px) / hero eyebrow
  (12px) / sidebar New (13px) pinned explicitly.
- **Verification**: full core lane = 18 failed / 111 passed / 5 skipped. All 18
  are the pre-existing baseline set; timeline-pinning:466 and
  composer-controls:185 are a proven flake pair (identical failure signature on
  the pre-P9 build c9a8d7d). No new failures vs baseline; 4 baseline failures
  fixed along the way (settings-appearance, terminal-diff-layout,
  new-thread-composer, skills-settings-era flakes).
- **Remaining CSS files** (all documented state machines / shared primitives /
  programmatic nodes): tokens, shadcn, base, topbar (Electron chrome), sidebar
  (.shell), main (.main), timeline (keyframes), syntax-highlight (prose).
- **Open items (none blocking)**: 17-18 pre-existing baseline E2E failures
  unrelated to styling (virtualization races, terminal, multi-window, login
  prompt, etc.).
