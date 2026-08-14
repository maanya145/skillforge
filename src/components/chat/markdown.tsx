import { cn } from "@/lib/utils"

/**
 * A deliberately tiny markdown renderer for assistant messages.
 *
 * The mentor is instructed to write prose, but free models emit **bold**,
 * `code`, bullet lists and links regardless — rendering those as literal
 * asterisks is the single most amateur thing a chat UI can do. A full
 * markdown pipeline is not worth the bundle here: this covers what actually
 * appears, and anything unrecognised falls through as plain text rather than
 * breaking.
 *
 * No `dangerouslySetInnerHTML` anywhere — every node is React, so model
 * output can never inject markup.
 */
export function Markdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const blocks = content.trim().split(/\n{2,}/)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n")
        const isBullets = lines.every((l) => /^\s*[-*•]\s+/.test(l))
        const isNumbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l))

        if (isBullets || isNumbered) {
          const Tag = isNumbered ? "ol" : "ul"
          return (
            <Tag
              key={i}
              className={cn(
                "flex list-outside flex-col gap-1 pl-4",
                isNumbered ? "list-decimal" : "list-disc"
              )}
            >
              {lines.map((l, j) => (
                <li key={j} className="pl-0.5">
                  <Inline text={l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")} />
                </li>
              ))}
            </Tag>
          )
        }

        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={block} />
          </p>
        )
      })}
    </div>
  )
}

/** Bold, inline code and links, in one pass so they can't nest badly. */
function Inline({ text }: { text: string }) {
  const pattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/g
  const parts = text.split(pattern).filter(Boolean)

  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return (
            <strong key={i} className="font-[510] text-mist">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (/^`[^`]+`$/.test(part)) {
          return (
            <code
              key={i}
              className="rounded-sm bg-white/[0.06] px-1 py-px font-mono text-xs text-mist"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        const linked = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
        if (linked) {
          return (
            <ExternalLink key={i} href={linked[2]}>
              {linked[1]}
            </ExternalLink>
          )
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <ExternalLink key={i} href={part}>
              {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
            </ExternalLink>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-mist underline decoration-graphite underline-offset-2 transition-colors hover:text-paper hover:decoration-smoke"
    >
      {children}
    </a>
  )
}
