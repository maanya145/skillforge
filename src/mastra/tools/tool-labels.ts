/**
 * Tool id → what the student sees.
 *
 * Deliberately its own module with no imports: the chat client renders these,
 * and importing them from mentor-tools.ts would pull the database client and
 * every server-only query into the browser bundle.
 */
export const TOOL_LABELS: Record<string, string> = {
  get_skill_map: "Read your skill map",
  explain_track: "Opened the rubric",
  get_roadmap: "Checked your roadmap",
  get_recommendations: "Read your recommendations",
  compare_target_roles: "Compared target roles",
  find_learning_resources: "Searched the web",
  look_up_concept: "Looked up a definition",
  preview_link: "Read the page preview",
  resolve_portfolio_repository: "Checked the repository link",
  inspect_portfolio_repository: "Inspected your repository",
}
