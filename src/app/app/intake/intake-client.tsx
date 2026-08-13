"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

type ProgressEntry = { key: string; label: string; value: string }
type RunStatus = "queued" | "running" | "succeeded" | "failed"

type RunState = {
  id: string
  status: RunStatus
  currentStep: string | null
  progress: ProgressEntry[]
  error: string | null
}

const POLL_MS = 800

export function IntakeClient({
  roles,
  currentRoleId,
}: {
  roles: { id: string; name: string }[]
  currentRoleId: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [roleId, setRoleId] = useState(currentRoleId ?? roles[0]?.id ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<RunState | null>(null)

  const busy = uploading || run?.status === "queued" || run?.status === "running"

  // Poll while a run is in flight. Stops on a terminal status so a failed run
  // doesn't spin forever.
  useEffect(() => {
    if (!run || run.status === "succeeded" || run.status === "failed") return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${run.id}`, { cache: "no-store" })
        if (!res.ok) return
        const next: RunState = await res.json()
        setRun(next)

        if (next.status === "succeeded") {
          clearInterval(timer)
          router.refresh()
          router.push("/app/map")
        }
      } catch {
        // A dropped poll is not a failed run; the next tick retries.
      }
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [run, router])

  async function upload(selected: File) {
    setError(null)
    setUploading(true)

    const body = new FormData()
    body.append("resume", selected)
    if (roleId) body.append("roleId", roleId)

    try {
      const res = await fetch("/api/resume/upload", { method: "POST", body })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "The upload failed.")
        return
      }

      setRun({
        id: data.runId,
        status: "queued",
        currentStep: null,
        progress: [],
        error: null,
      })
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setUploading(false)
    }
  }

  function choose(selected: File | undefined | null) {
    if (!selected) return
    setFile(selected)
    void upload(selected)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <SubCard
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) choose(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex flex-col items-start gap-3 border border-dashed border-graphite p-6 transition-colors",
          dragging && "border-mist bg-white/[0.04]",
          busy && "opacity-60"
        )}
      >
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-fog" aria-hidden />
          <div>
            <p className="text-caption text-mist">
              {file ? file.name : "Drop a PDF, or choose a file"}
            </p>
            <p className="font-mono text-xs text-ash">
              {file
                ? `${Math.round(file.size / 1024)} KB`
                : "Up to 8 MB · text-based PDFs only"}
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
          disabled={busy}
        />

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload aria-hidden />
          {busy ? "Analysing…" : file ? "Choose another" : "Choose a PDF"}
        </Button>
      </SubCard>

      {/* Target role */}
      <SubCard>
        <span className="t-micro">Target role</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={busy}
              aria-pressed={roleId === r.id}
              onClick={() => setRoleId(r.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50",
                roleId === r.id
                  ? "bg-paper text-void"
                  : "bg-white/5 text-fog hover:text-mist"
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ash">
          Gaps are measured against this role&rsquo;s benchmark. Changing it
          re-measures every track.
        </p>
      </SubCard>

      {/* Live run */}
      {run ? (
        <SubCard>
          <div className="flex items-center justify-between gap-3">
            <span className="t-micro">Analysis</span>
            {run.status === "failed" ? (
              <Badge variant="err">
                <BadgeDot />
                Failed
              </Badge>
            ) : run.status === "succeeded" ? (
              <Badge variant="ok">
                <BadgeDot />
                Done
              </Badge>
            ) : (
              <Badge variant="tag">
                <BadgeDot />
                {run.currentStep ?? "Queued"}
              </Badge>
            )}
          </div>

          <ul className="mt-3 flex flex-col gap-1">
            {run.progress.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-2 font-mono text-xs text-fog"
              >
                <span className="text-pulse-green">✓</span>
                {p.label}
                <span className="ml-auto text-mist">{p.value}</span>
              </li>
            ))}
            {busy ? (
              <li className="flex items-center gap-2 font-mono text-xs text-ash">
                <span className="animate-pulse">•</span>
                Reading the resume — the free model tier takes a moment
              </li>
            ) : null}
          </ul>

          {run.status === "failed" ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-graphite pt-3">
              <p className="text-xs text-coral-red">
                {run.error ?? "The analysis failed."}
              </p>
              <Button
                type="button"
                size="sm"
                className="self-start"
                onClick={() => file && upload(file)}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </SubCard>
      ) : null}

      {error ? (
        <SubCard className="border border-coral-red/30">
          <p className="text-xs text-coral-red">{error}</p>
        </SubCard>
      ) : null}
    </div>
  )
}
