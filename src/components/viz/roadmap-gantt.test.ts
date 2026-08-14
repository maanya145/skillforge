import { describe, it, expect } from "vitest"

import { groupRows, type GanttItem } from "./roadmap-gantt"

const item = (
  label: string,
  startWeek: number,
  endWeek: number,
  id = `${label}-${startWeek}`
): GanttItem => ({
  id,
  label,
  detail: "",
  lane: "drill",
  kind: "drill",
  startWeek,
  endWeek,
})

describe("groupRows", () => {
  it("puts same-label items that don't overlap on one row", () => {
    const rows = groupRows([item("Mock", 8, 8), item("Mock", 12, 12)])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveLength(2)
  })

  /**
   * The bug this guards: grouping on label alone placed overlapping items in
   * the same grid cells, where they stacked and the lower one disappeared.
   */
  it("splits same-label items that overlap onto separate rows", () => {
    const rows = groupRows([item("Mock", 1, 6), item("Mock", 4, 9)])
    expect(rows).toHaveLength(2)
    expect(rows.flat()).toHaveLength(2)
  })

  it("treats touching-but-not-overlapping weeks as shareable", () => {
    const rows = groupRows([item("Mock", 1, 3), item("Mock", 4, 6)])
    expect(rows).toHaveLength(1)
  })

  it("keeps different labels on their own rows", () => {
    const rows = groupRows([item("A", 1, 3), item("B", 1, 3)])
    expect(rows).toHaveLength(2)
  })

  it("never drops an item", () => {
    const items = [
      item("Mock", 1, 5),
      item("Mock", 3, 7),
      item("Mock", 6, 9),
      item("Other", 2, 4),
    ]
    expect(groupRows(items).flat()).toHaveLength(items.length)
  })
})
