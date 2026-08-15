"use client"

import { defineComponent, createLibrary } from "@openuidev/react-lang"
import { z } from "zod/v4"

import { SubCard } from "@/components/shell/frame"
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
  components: [Answer, Text, Callout, Code, Flow, DataTable, Terms, Steps, Stat],
})
