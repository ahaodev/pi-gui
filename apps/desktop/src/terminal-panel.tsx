import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Terminal } from "@xterm/xterm";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import type { WorkspaceRecord } from "./desktop-state";
import { CloseIcon, MaximizeIcon, MinimizeIcon, PlusIcon, RefreshIcon } from "./icons";
import type { TerminalPanelSnapshot, TerminalSessionSnapshot, TerminalSize } from "./ipc";
import { appendTerminalReplay } from "./terminal-model";

const MIN_TERMINAL_HEIGHT = 220;
const DEFAULT_TERMINAL_HEIGHT = 340;

interface TerminalPanelProps {
  readonly workspace: WorkspaceRecord;
  readonly sessionId: string;
  readonly height: number;
  readonly isTakeover: boolean;
  readonly onHeightChange: (height: number) => void;
  readonly onToggleTakeover: () => void;
  readonly onHide: () => void;
}

export function TerminalPanel({
  workspace,
  sessionId,
  height,
  isTakeover,
  onHeightChange,
  onToggleTakeover,
  onHide,
}: TerminalPanelProps) {
  const api = window.piApp;
  const panelRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const activeTerminalIdRef = useRef("");
  const lastSizeRef = useRef<TerminalSize>({ cols: 80, rows: 24 });
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const [panel, setPanel] = useState<TerminalPanelSnapshot | null>(null);
  const [error, setError] = useState<string>("");

  const activeSession = useMemo(
    () => panel?.sessions.find((session) => session.id === panel.activeSessionId),
    [panel],
  );

  const requestPanel = useCallback(async () => {
    if (!api) {
      return;
    }
    try {
      const nextPanel = await api.ensureTerminalPanel(workspace.id, sessionId, lastSizeRef.current);
      setPanel(nextPanel);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api, sessionId, workspace.id]);

  useEffect(() => {
    setPanel(null);
    setError("");
    void requestPanel();
  }, [requestPanel]);

  const createTerminal = useCallback(async () => {
    if (!api) {
      return;
    }
    const nextPanel = await api.createTerminalSession(workspace.id, sessionId, lastSizeRef.current);
    setPanel(nextPanel);
  }, [api, sessionId, workspace.id]);

  const setActiveTerminal = useCallback(async (terminalId: string) => {
    if (!api) {
      return;
    }
    const nextPanel = await api.setActiveTerminalSession(workspace.id, sessionId, terminalId);
    setPanel(nextPanel);
  }, [api, sessionId, workspace.id]);

  const closeTerminal = useCallback(async (terminalId: string) => {
    if (!api) {
      return;
    }
    const nextPanel = await api.closeTerminalSession(terminalId);
    if (nextPanel) {
      setPanel(nextPanel);
    } else {
      setPanel(null);
      onHide();
    }
  }, [api, onHide]);

  const restartTerminal = useCallback(async () => {
    if (!api || !activeSession) {
      return;
    }
    const nextPanel = await api.restartTerminalSession(activeSession.id, lastSizeRef.current);
    terminalRef.current?.reset();
    setPanel(nextPanel);
  }, [activeSession, api]);

  const fitAndResize = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const terminalId = activeTerminalIdRef.current;
    if (!api || !terminalId || !terminal || !fitAddon || !containerRef.current) {
      return;
    }
    fitAddon.fit();
    const nextSize = { cols: terminal.cols, rows: terminal.rows };
    if (nextSize.cols === lastSizeRef.current.cols && nextSize.rows === lastSizeRef.current.rows) {
      return;
    }
    lastSizeRef.current = nextSize;
    void api.resizeTerminal(terminalId, nextSize);
  }, [api]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!api || !panelElement) {
      return undefined;
    }
    const markFocused = () => {
      void api.setTerminalFocused(true);
    };
    const markBlurred = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && panelElement.contains(event.relatedTarget)) {
        return;
      }
      void api.setTerminalFocused(false);
    };
    panelElement.addEventListener("focusin", markFocused);
    panelElement.addEventListener("focusout", markBlurred);
    return () => {
      panelElement.removeEventListener("focusin", markFocused);
      panelElement.removeEventListener("focusout", markBlurred);
      void api.setTerminalFocused(false);
    };
  }, [api]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }
    const removeData = api.onTerminalData((event) => {
      setPanel((currentPanel) => updateSession(currentPanel, event.terminalId, (session) => ({
        ...session,
        ...appendTerminalReplay(session.replay, event.data, session.truncated),
      })));
      if (event.terminalId === activeTerminalIdRef.current) {
        terminalRef.current?.write(event.data);
      }
    });
    const removeExit = api.onTerminalExit((event) => {
      setPanel((currentPanel) => updateSession(currentPanel, event.terminalId, (session) => ({
        ...session,
        status: "exited",
        exitCode: event.exitCode,
        signal: event.signal,
      })));
    });
    const removeError = api.onTerminalError((event) => {
      setPanel((currentPanel) => updateSession(currentPanel, event.terminalId, (session) => ({
        ...session,
        status: "error",
        ...appendTerminalReplay(session.replay, `${event.message}\r\n`, session.truncated),
      })));
    });
    return () => {
      removeData();
      removeExit();
      removeError();
    };
  }, [api]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!api || !panelElement) {
      return undefined;
    }
    // Route the platform paste shortcut into the xterm ourselves. On non-mac
    // platforms xterm consumes Ctrl+V as the SYN control character and cancels
    // the browser default paste, so clipboard text would never reach the pty;
    // this capture-phase listener fires before the xterm's own textarea
    // handler and pastes through the same bracketed-paste path. (On macOS the
    // same handler keeps Cmd+V behavior identical.)
    const handlePanelKeyDown = (event: globalThis.KeyboardEvent) => {
      const commandModifier = api.platform === "darwin" ? event.metaKey : event.ctrlKey;
      if (!commandModifier || event.shiftKey || event.key.toLowerCase() !== "v") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void api.readClipboardText().then((text) => {
        if (text) {
          terminalRef.current?.paste(text);
        }
      });
    };
    panelElement.addEventListener("keydown", handlePanelKeyDown, true);
    return () => {
      panelElement.removeEventListener("keydown", handlePanelKeyDown, true);
    };
  }, [api]);

  useEffect(() => {
    const container = containerRef.current;
    if (!api || !container || !activeSession) {
      return undefined;
    }

    activeTerminalIdRef.current = activeSession.id;
    const terminal = new Terminal({
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: "Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
      fontSize: 12,
      scrollback: 2_000,
      theme: {
        background: "#0f1117",
        foreground: "#d7dae0",
        cursor: "#f2f4f8",
        selectionBackground: "#39557a",
      },
    });
    const fitAddon = new FitAddon();
    const clipboardAddon = new ClipboardAddon();
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      void api.openExternal(uri);
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(clipboardAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }
      const commandModifier = api.platform === "darwin" ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();
      if (commandModifier && !event.shiftKey && key === "t") {
        void createTerminal();
        return false;
      }
      if (api.platform === "darwin" && event.metaKey) {
        const sequence = macTerminalSequenceForEvent(event);
        if (sequence) {
          void api.writeTerminal(activeSession.id, sequence);
          return false;
        }
      }
      return true;
    });
    terminal.onData((data) => {
      void api.writeTerminal(activeSession.id, data);
    });
    terminal.onTitleChange((title) => {
      void api.setTerminalTitle(activeSession.id, title);
      setPanel((currentPanel) => updateSession(currentPanel, activeSession.id, (session) => ({
        ...session,
        title: title.trim() || session.title,
      })));
    });
    terminal.open(container);
    if (activeSession.replay) {
      terminal.write(activeSession.replay);
    }
    terminal.focus();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    window.requestAnimationFrame(fitAndResize);

    const resizeObserver = new ResizeObserver(() => fitAndResize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      fitAddonRef.current = null;
      terminalRef.current = null;
      activeTerminalIdRef.current = "";
      terminal.dispose();
    };
  }, [activeSession?.id, api, createTerminal, fitAndResize]);

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeCleanupRef.current?.();
    const startY = event.clientY;
    const startHeight = containerRef.current?.closest<HTMLElement>(".terminal-panel")?.offsetHeight ?? height;
    const maxHeight = Math.max(MIN_TERMINAL_HEIGHT, window.innerHeight - 140);

    const handleMove = (moveEvent: MouseEvent) => {
      const nextHeight = Math.min(maxHeight, Math.max(MIN_TERMINAL_HEIGHT, startHeight + startY - moveEvent.clientY));
      onHeightChange(nextHeight);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      resizeCleanupRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    resizeCleanupRef.current = handleUp;
  };

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  return (
    <section
      ref={panelRef}
      className={`terminal-panel relative z-[8] grid min-h-[220px] max-h-[calc(100vh-140px)] grid-rows-[auto_1fr] overflow-hidden border-t border-[#2a2e3a] bg-[#0f1117] text-[#d7dae0]${isTakeover ? " terminal-panel--takeover max-h-none grid-row-[2/-1] z-20" : ""}`}
      data-pi-terminal="true"
      data-testid="integrated-terminal"
      style={isTakeover ? undefined : { height: `${height || DEFAULT_TERMINAL_HEIGHT}px` }}
    >
      <div className="terminal-panel__resize-handle absolute inset-x-0 top-0 z-[2] h-1.5 cursor-ns-resize" onMouseDown={startResize} />
      <div className="terminal-panel__toolbar flex min-h-[38px] items-center justify-between gap-2.5 border-b border-[#242936] bg-[#171a22] py-[5px] pr-2 pl-2.5">
        <div className="terminal-panel__tabs flex min-w-0 items-center gap-1 overflow-x-auto" role="tablist" aria-label="终端会话">
          {(panel?.sessions ?? []).map((session) => (
            <div
              key={session.id}
              className={`terminal-panel__tab-item flex h-7 min-w-[112px] max-w-[220px] items-center gap-[3px] rounded-sm border px-1 pl-2 ${session.id === panel?.activeSessionId ? "terminal-panel__tab-item--active border-[#343b4c] bg-[#202532] text-[#f2f4f8]" : "border-transparent bg-transparent text-[#aeb6c6]"}`}
            >
              <button
                className="terminal-panel__tab flex h-full min-w-0 flex-1 cursor-pointer items-center gap-[7px] border-0 bg-transparent p-0 text-xs font-[560] text-inherit"
                type="button"
                role="tab"
                aria-selected={session.id === panel?.activeSessionId}
                data-testid="terminal-tab"
                onClick={() => void setActiveTerminal(session.id)}
              >
                <span className={`terminal-panel__status size-[7px] flex-none rounded-full ${terminalStatusClass(session.status)}`} />
                <span className="terminal-panel__tab-title min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{session.title}</span>
              </button>
              <button
                type="button"
                className="terminal-panel__tab-close grid size-5 flex-none cursor-pointer place-items-center rounded-[var(--radius-xs)] border-0 bg-transparent text-[#8791a4] [&_svg]:size-[13px] hover:bg-[#303747] hover:text-white"
                aria-label={`关闭 ${session.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void closeTerminal(session.id);
                }}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-panel__actions flex flex-none items-center gap-[3px]">
          <button type="button" className="terminal-panel__action grid size-7 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-[#aeb6c6] [&_svg]:size-3.5 hover:enabled:border-[#343b4c] hover:enabled:bg-[#202532] hover:enabled:text-white" title="新建终端" aria-label="新建终端" onClick={() => void createTerminal()}>
            <PlusIcon />
          </button>
          <button type="button" className="terminal-panel__action grid size-7 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-[#aeb6c6] [&_svg]:size-3.5 hover:enabled:border-[#343b4c] hover:enabled:bg-[#202532] hover:enabled:text-white" title="重启终端" aria-label="重启终端" onClick={() => void restartTerminal()}>
            <RefreshIcon />
          </button>
          <button
            type="button"
            className="terminal-panel__action grid size-7 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-[#aeb6c6] [&_svg]:size-3.5 hover:enabled:border-[#343b4c] hover:enabled:bg-[#202532] hover:enabled:text-white"
            title={isTakeover ? "还原终端" : "最大化终端"}
            aria-label={isTakeover ? "还原终端" : "最大化终端"}
            onClick={onToggleTakeover}
          >
            {isTakeover ? <MinimizeIcon /> : <MaximizeIcon />}
          </button>
          <button type="button" className="terminal-panel__action grid size-7 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-[#aeb6c6] [&_svg]:size-3.5 hover:enabled:border-[#343b4c] hover:enabled:bg-[#202532] hover:enabled:text-white" title="隐藏终端" aria-label="隐藏终端" onClick={onHide}>
            <CloseIcon />
          </button>
        </div>
      </div>
      {error ? (
        <div className="terminal-panel__error whitespace-pre-wrap p-[18px] font-mono text-xs text-error-ink">{error}</div>
      ) : (
        <div className="terminal-panel__viewport min-h-0 overflow-hidden px-2.5 py-2 [&_.xterm]:h-full" ref={containerRef} />
      )}
    </section>
  );
}

function terminalStatusClass(status: string): string {
  switch (status) {
    case "exited":
      return "terminal-panel__status--exited bg-[var(--status-neutral)]";
    case "error":
      return "terminal-panel__status--error bg-[var(--status-error)]";
    default:
      return "terminal-panel__status--running bg-[var(--status-running)]";
  }
}

function updateSession(
  panel: TerminalPanelSnapshot | null,
  terminalId: string,
  update: (session: TerminalSessionSnapshot) => TerminalSessionSnapshot,
): TerminalPanelSnapshot | null {
  if (!panel) {
    return panel;
  }
  return {
    ...panel,
    sessions: panel.sessions.map((session) => session.id === terminalId ? update(session) : session),
  };
}

function macTerminalSequenceForEvent(event: KeyboardEvent): string | undefined {
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp":
      return "\x01";
    case "ArrowRight":
    case "ArrowDown":
      return "\x05";
    case "Backspace":
      return "\x15";
    case "Delete":
      return "\x0b";
    default:
      return undefined;
  }
}
