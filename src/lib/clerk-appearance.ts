/**
 * Clerk's hosted components, brought inside the design system.
 *
 * Clerk ships its own light-mode defaults with rounded cards and a blue accent,
 * none of which belong here. Variables cover the palette; the element overrides
 * fix the two things variables can't reach — the radius vocabulary and the
 * weight cap (nothing above 590).
 */
export const clerkAppearance = {
  variables: {
    colorBackground: "#0f1011",
    colorForeground: "#d0d6e0",
    colorPrimary: "#e4f222",
    colorPrimaryForeground: "#08090a",
    colorInput: "rgba(255,255,255,0.02)",
    colorInputForeground: "#d0d6e0",
    colorMuted: "rgba(255,255,255,0.03)",
    colorMutedForeground: "#8a8f98",
    colorBorder: "#23252a",
    colorRing: "#d0d6e0",
    colorDanger: "#eb5757",
    colorSuccess: "#27a644",
    colorWarning: "#e4f222",
    fontFamily: "var(--font-inter)",
    fontSize: "14px",
    borderRadius: "6px",
  },
  elements: {
    rootBox: "w-full max-w-[400px]",
    cardBox: "rounded-xl shadow-none",
    card: "bg-card border border-graphite shadow-none",
    headerTitle: "text-paper font-[510] tracking-[-0.012em]",
    headerSubtitle: "text-fog",
    formButtonPrimary:
      "bg-acid-lime text-void font-[510] rounded-md hover:bg-[#eef84a] shadow-none normal-case",
    socialButtonsBlockButton:
      "border-graphite text-mist rounded-md hover:border-smoke",
    formFieldInput: "rounded-md border-graphite bg-white/[0.02] text-mist",
    footerActionLink: "text-mist hover:text-paper",
    dividerLine: "bg-graphite",
    dividerText: "text-ash",
  },
}
