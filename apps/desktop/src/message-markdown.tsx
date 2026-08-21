import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

const MARKDOWN_COMPONENTS = {
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const code = String(children).replace(/\n$/, "");
    return <code className={className}>{code}</code>;
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
} as const;

/**
 * Prose styling for transcript markdown, expressed as Tailwind utilities with
 * descendant variants (the former `.message__content` CSS block).
 */
const messageContentClass = [
  "message__content grid max-w-full min-w-0 gap-[9px] wrap-anywhere leading-[1.65] text-foreground-strong",
  // Block resets
  "[&>*:first-child]:mt-0",
  "[&>*:last-child]:mb-0",
  "[&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_pre]:m-0 [&_blockquote]:m-0",
  "[&_p]:min-w-0 [&_ul]:min-w-0 [&_ol]:min-w-0 [&_pre]:min-w-0 [&_blockquote]:min-w-0",
  "[&_ul]:pl-5 [&_ol]:pl-5",
  "[&_li+li]:mt-1",
  // Code
  "[&_code]:font-mono [&_code]:text-[0.92em]",
  "[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-[var(--theme-code-bg,var(--code-inline-bg))] [&_:not(pre)>code]:px-[0.38em] [&_:not(pre)>code]:py-[0.1em] [&_:not(pre)>code]:text-[var(--theme-code-ink,var(--code-ink))]",
  "[&_pre]:max-w-full [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[var(--theme-code-border,var(--code-border))] [&_pre]:bg-[var(--theme-code-bg,var(--code-block-bg))] [&_pre]:px-3.5 [&_pre]:py-3 [&_pre]:overflow-auto [&_pre]:wrap-anywhere [&_pre]:whitespace-pre-wrap [&_pre]:text-[var(--theme-code-ink,var(--code-ink))]",
  "[&_pre>code]:block [&_pre>code]:min-w-0 [&_pre>code]:text-inherit [&_pre>code]:[overflow-wrap:inherit] [&_pre>code]:[white-space:inherit]",
  // Blockquote + links
  "[&_blockquote]:border-l-3 [&_blockquote]:border-l-[var(--theme-control-border,var(--line-strong))] [&_blockquote]:pl-3 [&_blockquote]:text-muted-strong",
  "[&_a]:text-[var(--accent)] [&_a]:no-underline [&_a:hover]:underline",
].join(" ");

export function MessageMarkdown({ text }: { readonly text: string }) {
  return (
    <div className={messageContentClass}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
