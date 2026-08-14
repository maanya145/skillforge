"use client"

import { ScreenError } from "@/components/shell/screen-states"

export default function Error(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ScreenError {...props} screen="Mentor" />
}
