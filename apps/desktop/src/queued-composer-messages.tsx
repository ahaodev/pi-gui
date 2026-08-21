import type { ComposerAttachment, QueuedComposerMessage } from "./desktop-state";
import { FileIcon } from "./icons";
import { cn } from "@/lib/utils";

interface QueuedComposerMessagesProps {
  readonly messages: readonly QueuedComposerMessage[];
  readonly editingQueuedMessageId?: string;
  readonly onEditMessage: (messageId: string) => void;
  readonly onRemoveMessage: (messageId: string) => void;
  readonly onSteerMessage: (messageId: string) => void;
  readonly onCancelEdit: () => void;
}

const queuedActionButton =
  "cursor-pointer border-0 bg-transparent p-0 text-muted-soft transition hover:text-foreground-strong";

export function QueuedComposerMessages({
  messages,
  editingQueuedMessageId,
  onEditMessage,
  onRemoveMessage,
  onSteerMessage,
  onCancelEdit,
}: QueuedComposerMessagesProps) {
  if (messages.length === 0 && !editingQueuedMessageId) {
    return null;
  }

  return (
    <div className="queued-composer-messages mb-2.5 grid gap-2.5" data-testid="queued-composer-messages">
      {editingQueuedMessageId ? (
        <div
          className="queued-composer-messages__editing flex items-center justify-between gap-3 rounded-2xl border border-border bg-[var(--surface-muted)] p-2.5 text-[13px] font-[560] text-muted-strong"
          data-testid="queued-composer-editing"
        >
          <span>正在编辑排队消息</span>
          <button className={queuedActionButton} type="button" onClick={onCancelEdit}>
            取消
          </button>
        </div>
      ) : null}
      {messages.map((message) => (
        <div
          className={cn(
            "queued-composer-message grid gap-2.5 rounded-3xl border border-border bg-[linear-gradient(180deg,var(--main),var(--surface-muted))] p-3 pl-3.5 pr-3.5",
            message.id === editingQueuedMessageId &&
              "queued-composer-message--editing border-[var(--focus-ring-border)] shadow-[var(--focus-ring)]",
          )}
          data-testid="queued-composer-message"
          key={message.id}
        >
          <div className="queued-composer-message__header flex items-start justify-between gap-3">
            {message.text ? (
              <div className="queued-composer-message__text min-w-0 flex-1 whitespace-pre-wrap text-[14px] leading-[1.45] text-foreground-strong">
                {message.text}
              </div>
            ) : null}
            <div className="queued-composer-message__actions flex shrink-0 items-center justify-end gap-2.5 whitespace-nowrap">
              {message.mode !== "steer" ? (
                <button className={queuedActionButton} type="button" onClick={() => onSteerMessage(message.id)}>
                  引导
                </button>
              ) : null}
              <button className={queuedActionButton} type="button" onClick={() => onEditMessage(message.id)}>
                编辑
              </button>
              <button
                aria-label={`删除排队消息 ${message.text || message.id}`}
                className={queuedActionButton}
                type="button"
                onClick={() => onRemoveMessage(message.id)}
              >
                删除
              </button>
            </div>
          </div>
          {message.attachments.length > 0 ? (
            <div className="queued-composer-message__attachments flex flex-wrap gap-2">
              {message.attachments.map((attachment, index) => (
                <QueuedAttachmentPreview
                  attachment={attachment}
                  key={`${message.id}:${attachment.name}:${index}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function QueuedAttachmentPreview({ attachment }: { readonly attachment: ComposerAttachment }) {
  return (
    <div
      className={cn(
        "queued-composer-attachment flex min-w-0 max-w-[220px] items-center gap-2 rounded-full border border-border bg-[var(--surface-overlay)] py-1.25 pr-2.25 pl-1.25",
        `queued-composer-attachment--${attachment.kind}`,
      )}
    >
      {attachment.kind === "image" ? (
        <img
          alt={attachment.name}
          className="queued-composer-attachment__preview size-6 rounded-md bg-[var(--surface-muted)] object-cover"
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
        />
      ) : (
        <span
          className="queued-composer-attachment__icon grid size-6 flex-none place-items-center rounded-md bg-[var(--surface-muted)] text-muted-soft [&_svg]:size-3.5"
          aria-hidden="true"
        >
          <FileIcon />
        </span>
      )}
      <span className="queued-composer-attachment__name min-w-0 truncate text-xs font-[520] text-muted-strong">
        {attachment.name}
      </span>
    </div>
  );
}
