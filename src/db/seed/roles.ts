export type RoleSeed = {
  id: string
  name: string
  blurb: string
  sortOrder: number
}

export const ROLES: RoleSeed[] = [
  {
    id: "backend-engineer",
    name: "Backend engineer",
    blurb: "Services, data and the systems behind them.",
    sortOrder: 0,
  },
  {
    id: "data-engineer",
    name: "Data engineer",
    blurb: "Pipelines, warehouses and the correctness of what lands in them.",
    sortOrder: 1,
  },
  {
    id: "full-stack",
    name: "Full stack",
    blurb: "Product surface to database, usually on a small team.",
    sortOrder: 2,
  },
  {
    id: "sdet",
    name: "SDET",
    blurb: "Test infrastructure and the automation that keeps releases honest.",
    sortOrder: 3,
  },
  {
    id: "ml-engineer",
    name: "ML engineer",
    blurb: "Models in production, and the plumbing that keeps them fed.",
    sortOrder: 4,
  },
]
