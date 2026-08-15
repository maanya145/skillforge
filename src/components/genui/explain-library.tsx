"use client"

import * as React from "react"
import { defineComponent, createLibrary } from "@openuidev/react-lang"
import { ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { z } from "zod/v4"

import { SubCard } from "@/components/shell/frame"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * The Understand screen's component grammar.
 *
 * A second, deliberately different library from the studio's: this one
 * explains *pasted material* — notes, code, an error log — so its blocks are
 * explainer shapes (code, flows, tables, terms) and it has NO media blocks.
 * Media requires the preview_link tool for grounding, and the explainer agent
 * has no tools at all; a grammar that cannot express an image is a stronger
 * guarantee than a prompt that asks nicely.
 *
 * Every renderer is on the Linear tokens, so generated explanations are
 * indistinguishable from hand-built screens.
 */

const Text = defineComponent({
  name: "Text",
  description:
    "A short paragraph of plain prose. Use between visual blocks to carry the narrative.",
  props: z.object({ content: z.string() }),
  component: ({ props }) => (
    <p className="text-body-sm text-fog">{props.content}</p>
  ),
})

const Callout = defineComponent({
  name: "Callout",
  description:
    "The one thing the reader should not miss. tone 'insight' for the key idea, 'warning' for a pitfall or bug.",
  props: z.object({
    tone: z.enum(["insight", "warning"]),
    content: z.string(),
  }),
  component: ({ props }) => (
    <p
      className={cn(
        "border-l-2 py-1 pl-3 text-body-sm",
        props.tone === "warning"
          ? "border-coral-red/60 text-mist"
          : "border-pulse-green/60 text-mist"
      )}
    >
      {props.content}
    </p>
  ),
})

const Code = defineComponent({
  name: "Code",
  description:
    "A code block, quoted from the material or a minimal corrected/illustrative version of it. Keep it short — quote the lines that matter, not the whole file.",
  props: z.object({
    title: z.string().optional().describe("e.g. 'the fix' or 'lines 12–18'"),
    language: z.string().optional(),
    code: z.string(),
  }),
  component: ({ props }) => (
    <figure className="overflow-hidden rounded-md bg-void shadow-subtle">
      {props.title ? (
        <figcaption className="flex items-baseline justify-between border-b border-graphite px-3 py-1.5">
          <span className="text-xs text-mist">{props.title}</span>
          {props.language ? (
            <span className="font-mono text-xs text-ash">{props.language}</span>
          ) : null}
        </figcaption>
      ) : null}
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed whitespace-pre text-mist">
        {props.code}
      </pre>
    </figure>
  ),
})

const Flow = defineComponent({
  name: "Flow",
  description:
    "A left-to-right chain of stages with arrows — for control flow, data flow, a pipeline, a lifecycle. 3 to 7 short node labels.",
  props: z.object({
    title: z.string().optional(),
    nodes: z.array(z.string().max(40)).min(2).max(7),
  }),
  component: ({ props }) => (
    <div>
      {props.title ? (
        <p className="t-micro mb-2">{props.title}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-y-2">
        {props.nodes.map((node, i) => (
          <span key={i} className="flex items-center">
            <span className="rounded-md bg-white/[0.04] px-3 py-1.5 text-xs text-mist shadow-subtle">
              {node}
            </span>
            {i < props.nodes.length - 1 ? (
              <span aria-hidden className="px-2 text-smoke">
                →
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  ),
})

const DataTable = defineComponent({
  name: "Table",
  description:
    "A compact comparison or reference table. Use when the material contrasts things — options, cases, complexities. Max 5 columns.",
  props: z.object({
    headers: z.array(z.string()).min(2).max(5),
    rows: z.array(z.array(z.string())).min(1).max(8),
  }),
  component: ({ props }) => (
    <div className="overflow-x-auto rounded-md bg-white/[0.02] shadow-subtle">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            {props.headers.map((h, i) => (
              <th
                key={i}
                className="t-micro border-b border-graphite px-3 py-2 font-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i} className="border-b border-graphite/50 last:border-b-0">
              {row.slice(0, props.headers.length).map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-3 py-2",
                    j === 0 ? "text-mist" : "text-fog"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
})

const Terms = defineComponent({
  name: "Terms",
  description:
    "Definitions for the jargon the material assumes. Only terms that actually appear in it.",
  props: z.object({
    items: z
      .array(z.object({ term: z.string().max(60), definition: z.string() }))
      .min(1)
      .max(8),
  }),
  component: ({ props }) => (
    <dl className="flex flex-col">
      {props.items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 border-t border-graphite/60 py-2 first:border-t-0 sm:flex-row sm:gap-4"
        >
          <dt className="shrink-0 font-mono text-xs text-mist sm:w-44">
            {item.term}
          </dt>
          <dd className="text-xs text-fog">{item.definition}</dd>
        </div>
      ))}
    </dl>
  ),
})

const Steps = defineComponent({
  name: "Steps",
  description:
    "An ordered walkthrough — what happens first, then, then. For tracing execution or a procedure in the notes.",
  props: z.object({ items: z.array(z.string()).min(2).max(10) }),
  component: ({ props }) => (
    <ol className="flex flex-col gap-2">
      {props.items.map((item, i) => (
        <li key={i} className="flex items-baseline gap-3">
          <span className="w-4 shrink-0 font-mono text-xs tabular text-ash">
            {i + 1}
          </span>
          <span className="text-body-sm text-mist">{item}</span>
        </li>
      ))}
    </ol>
  ),
})

const Stat = defineComponent({
  name: "Stat",
  description:
    "One labelled figure the material states or directly implies — a complexity, a count, a limit. Never invent one.",
  props: z.object({
    label: z.string(),
    value: z.string(),
    caption: z.string().optional(),
  }),
  component: ({ props }) => (
    <SubCard className="inline-block min-w-[140px]">
      <span className="t-micro">{props.label}</span>
      <div className="mt-1 font-mono text-xl tabular text-paper">
        {props.value}
      </div>
      {props.caption ? (
        <p className="mt-1 text-xs text-ash">{props.caption}</p>
      ) : null}
    </SubCard>
  ),
})

/**
 * The step-through debugger — the reason this surface exists.
 *
 * The model authors the FRAMES (all data, decided once); the stepping is
 * renderer-local React state, so the student drives the execution with zero
 * model round-trips. A loop explained as a Trace is an animation the student
 * controls; the same loop explained as a Table is a textbook page.
 */
const Trace = defineComponent({
  name: "Trace",
  description:
    "An interactive step-through of an algorithm or loop. Show the sequence being walked as cells, and one frame per meaningful step: which index is active, which it's compared against, the verdict, and the variables after the step. ALWAYS prefer this over Table for loops, recursion, and pointer algorithms.",
  props: z.object({
    title: z.string().optional(),
    cells: z
      .array(z.string().max(12))
      .min(2)
      .max(16)
      .describe("The array/sequence being traversed, one label per cell"),
    frames: z
      .array(
        z.object({
          label: z.string().max(90).describe("e.g. 'i=2 · 2 > 5 → False'"),
          highlight: z.number().int().min(0).optional().describe("active cell index"),
          compare: z.number().int().min(0).optional().describe("cell compared against"),
          verdict: z.enum(["keep", "skip", "note"]).optional(),
          vars: z
            .array(z.object({ name: z.string().max(20), value: z.string().max(60) }))
            .max(4)
            .optional()
            .describe("state AFTER this step, e.g. result so far"),
        })
      )
      .min(2)
      .max(14),
  }),
  component: ({ props }) => <TraceView {...props} />,
})

function TraceView({
  title,
  cells,
  frames,
}: {
  title?: string
  cells: string[]
  frames: {
    label: string
    highlight?: number
    compare?: number
    verdict?: "keep" | "skip" | "note"
    vars?: { name: string; value: string }[]
  }[]
}) {
  const [step, setStep] = React.useState(0)
  const frame = frames[Math.min(step, frames.length - 1)]
  const verdict =
    frame.verdict === "keep"
      ? { label: "keep", cls: "text-pulse-green" }
      : frame.verdict === "skip"
        ? { label: "skip", cls: "text-coral-red" }
        : null

  return (
    <div className="rounded-md bg-white/[0.02] p-3 shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <span className="t-micro">{title ?? "Step through it"}</span>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous step"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="grid size-6 place-items-center rounded-sm border border-graphite text-fog transition-colors hover:text-mist disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </button>
          <span className="w-12 text-center font-mono text-xs tabular text-ash">
            {step + 1}/{frames.length}
          </span>
          <button
            type="button"
            aria-label="Next step"
            disabled={step >= frames.length - 1}
            onClick={() => setStep((s) => Math.min(frames.length - 1, s + 1))}
            className="grid size-6 place-items-center rounded-sm border border-graphite text-fog transition-colors hover:text-mist disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {cells.map((cell, i) => (
          <span
            key={i}
            className={cn(
              "grid min-w-9 place-items-center rounded-sm px-2 py-1.5 font-mono text-xs transition-colors",
              i === frame.highlight
                ? "bg-bone text-void"
                : i === frame.compare
                  ? "bg-white/[0.06] text-mist shadow-[inset_0_0_0_1px_var(--color-smoke)]"
                  : "bg-white/[0.03] text-fog shadow-subtle"
            )}
          >
            {cell}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-baseline gap-2 border-t border-graphite pt-2.5">
        <span className="font-mono text-xs text-mist">{frame.label}</span>
        {verdict ? (
          <span className={cn("font-mono text-xs font-[590]", verdict.cls)}>
            {verdict.label}
          </span>
        ) : null}
      </div>
      {frame.vars?.length ? (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {frame.vars.map((v) => (
            <span key={v.name} className="font-mono text-xs text-ash">
              {v.name} = <span className="text-fog">{v.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Predict-then-check. Reading an answer is passive; committing to a guess
 * first is what makes it stick. The reveal is local state — no model call.
 */
const Reveal = defineComponent({
  name: "Reveal",
  description:
    "A prediction moment: pose a short question the student should answer in their head, hidden answer behind a click. Use once per explanation, at the point where guessing teaches the most — e.g. 'what does this return for [3,5,2]?'",
  props: z.object({
    prompt: z.string().max(160),
    answer: z.string().max(300),
  }),
  component: ({ props }) => <RevealView {...props} />,
})

function RevealView({ prompt, answer }: { prompt: string; answer: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-md border border-dashed border-smoke p-3">
      <p className="text-body-sm text-mist">{prompt}</p>
      {open ? (
        <p className="mt-2 border-t border-graphite pt-2 text-body-sm text-fog">
          {answer}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-fog transition-colors hover:text-mist"
        >
          <Eye className="size-3.5" aria-hidden />
          Decide first, then reveal
        </button>
      )}
    </div>
  )
}

const Answer = defineComponent({
  name: "Answer",
  description:
    "The root container: an ordered sequence of blocks that together explain the material.",
  props: z.object({
    blocks: z.array(
      z.union([
        Text.ref,
        Callout.ref,
        Code.ref,
        Trace.ref,
        Reveal.ref,
        Flow.ref,
        DataTable.ref,
        Terms.ref,
        Steps.ref,
        Stat.ref,
      ])
    ),
  }),
  component: ({ props, renderNode }) => (
    <div className="flex flex-col gap-4">{renderNode(props.blocks)}</div>
  ),
})

export const explainLibrary = createLibrary({
  root: "Answer",
  components: [Answer, Text, Callout, Code, Trace, Reveal, Flow, DataTable, Terms, Steps, Stat],
})
