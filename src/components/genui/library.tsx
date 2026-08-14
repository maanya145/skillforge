"use client"

import { defineComponent, createLibrary } from "@openuidev/react-lang"
import { z } from "zod/v4"

import { GapGauge } from "@/components/viz/gap-gauge"
import { SubCard } from "@/components/shell/frame"
import { Badge } from "@/components/ui/badge"

/**
 * The SkillForge OpenUI Lang library.
 *
 * The point of defining our own components rather than using
 * `@openuidev/react-ui`'s bundled set is that its `components.css` ships an
 * entire competing design system. Here every renderer is an existing
 * SkillForge component on the Linear tokens, so generated UI is
 * indistinguishable from hand-written screens and `check:design` still passes.
 *
 * The schemas are also a safety boundary, not just types. The model can only
 * emit these shapes — it cannot invent a component, and it cannot render a
 * gauge without supplying both the proven and required levels that make one
 * meaningful. A malformed block fails to parse and renders nothing rather than
 * rendering something misleading.
 */

const Text = defineComponent({
  name: "Text",
  description:
    "A short paragraph of plain prose. Use for explanation and context between visual blocks.",
  props: z.object({
    content: z.string(),
  }),
  component: ({ props }) => (
    <p className="text-body-sm text-fog">{props.content}</p>
  ),
})

const Gauge = defineComponent({
  name: "Gauge",
  description:
    "A skill track gauge showing what the student has proven against what the role requires. Use when discussing a specific track's level. Always take the numbers from a tool result — never estimate them.",
  props: z.object({
    trackId: z.string(),
    name: z.string().describe("Human-readable track name, e.g. 'Docker & CI/CD'"),
    provenLevel: z.number().describe("0-10, from the skill map"),
    requiredLevel: z.number().describe("0-10, what the role asks for"),
    weeksToClose: z.number(),
    note: z.string().describe("The one-line note from the skill map"),
  }),
  component: ({ props }) => {
    const gap = Math.max(0, props.requiredLevel - props.provenLevel)
    return (
      <GapGauge
        gauge={{
          trackId: props.trackId,
          name: props.name,
          provenLevel: props.provenLevel,
          requiredLevel: props.requiredLevel,
          gap,
          weeksToClose: props.weeksToClose,
          status:
            gap > 0
              ? "open"
              : props.provenLevel > props.requiredLevel
                ? "above"
                : "met",
          note: props.note,
        }}
      />
    )
  },
})

const Stat = defineComponent({
  name: "Stat",
  description:
    "A single labelled number, e.g. readiness or open gap count. Use sparingly, for the figure the answer turns on.",
  props: z.object({
    label: z.string(),
    value: z.string(),
    caption: z.string().optional(),
  }),
  component: ({ props }) => (
    <SubCard className="min-w-[140px]">
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

const Resource = defineComponent({
  name: "Resource",
  description:
    "A link to a course, project or repository, with what it closes. Only use URLs returned by a tool.",
  props: z.object({
    title: z.string(),
    url: z.string(),
    source: z.string().describe("Host, e.g. 'github.com'"),
    summary: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  component: ({ props }) => (
    <a
      href={props.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="block rounded-md bg-white/[0.02] p-3 shadow-subtle transition-colors hover:bg-white/[0.04]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-[510] text-mist">
          {props.title}
        </span>
        <span className="font-mono text-xs whitespace-nowrap text-ash">
          {props.source}
        </span>
      </div>
      <p className="mt-1 text-xs text-ash">{props.summary}</p>
      {props.tags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {props.tags.map((t) => (
            <Badge key={t} variant="tag">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
    </a>
  ),
})

const Steps = defineComponent({
  name: "Steps",
  description:
    "An ordered list of concrete next actions. Each item should be something the student could start today.",
  props: z.object({
    items: z.array(z.string()),
  }),
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

/**
 * The root. Everything the model emits is a sequence of these blocks — which
 * is what keeps generated output composed of vetted pieces rather than
 * arbitrary markup.
 */
const Answer = defineComponent({
  name: "Answer",
  description:
    "The root container. Holds an ordered sequence of blocks that together answer the student's question.",
  props: z.object({
    blocks: z.array(
      z.union([Text.ref, Gauge.ref, Stat.ref, Resource.ref, Steps.ref])
    ),
  }),
  component: ({ props, renderNode }) => (
    <div className="flex flex-col gap-3">{renderNode(props.blocks)}</div>
  ),
})

export const skillforgeLibrary = createLibrary({
  root: "Answer",
  components: [Answer, Text, Gauge, Stat, Resource, Steps],
})
