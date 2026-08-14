"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, ClipboardType } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge, BadgeDot } from "@/components/ui/badge"
import { SubCard } from "@/components/shell/frame"
import { cn } from "@/lib/utils"

type ProgressEntry = { key: string; label: string; value: string }
type RunStatus = "queued" | "running" | "succeeded" | "failed"

export type RunState = {
  id: string
  status: RunStatus
  currentStep: string | null
  progress: ProgressEntry[]
  error: string | null
}

/** Workflow step ids are internal; students see what is happening to them. */
const STEP_LABEL: Record<string, string> = {
  "load-context": "Reading your resume",
  extract: "Finding the evidence",
  score: "Scoring against the benchmark",
  plan: "Building your plan",
  persist: "Saving",
}

const POLL_MS = 1000
/** Give up just after the server's reaper, so the row is already marked. */
const POLL_LIMIT = 7 * 60
/** Vercel rejects request bodies over 4.5MB before our code ever runs. */
const MAX_BYTES = 4 * 1024 * 1024
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024)

export function IntakeClient({
  roles,
  currentRoleId,
  initialRun,
}: {
  roles: { id: string; name: string }[]
  currentRoleId: string | null
  /** An in-flight or recently failed run, so a refresh doesn't lose it. */
  initialRun: RunState | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [roleId, setRoleId] = useState(currentRoleId ?? roles[0]?.id ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<RunState | null>(initialRun)
  const [mode, setMode] = useState<"file" | "paste">("file")
  const [pastedText, setPastedText] = useState("")

  const active = run?.status === "queued" || run?.status === "running"
  const busy = uploading || active

  // ── Poll an in-flight run, including one adopted from a page refresh ───────
  useEffect(() => {
    if (!run || !active) return
    let ticks = 0

    const timer = setInterval(async () => {
      ticks++
      if (ticks > POLL_LIMIT) {
        clearInterval(timer)
        setRun((r) =>
          r
            ? {
                ...r,
                status: "failed",
                error:
                  "The analysis didn't finish in time — the free model service is slow right now. Try again, or paste your resume text instead.",
              }
            : r
        )
        return
      }
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
  }, [run, active, router])

  const submit = useCallback(
    async (body: FormData) => {
      setError(null)
      setUploading(true)
      try {
        const res = await fetch("/api/resume/upload", { method: "POST", body })

        // Non-JSON bodies are real: platform 413s, session expiry, crashes.
        const data = res.headers.get("content-type")?.includes("json")
          ? await res.json().catch(() => null)
          : null

        if (!res.ok) {
          // A concurrent run isn't an error — adopt it and start polling.
          if (res.status === 409 && data?.runId) {
            setRun({
              id: data.runId,
              status: "running",
              currentStep: null,
              progress: [],
              error: null,
            })
            return
          }
          setError(
            data?.error ??
              (res.status === 401
                ? "Your session expired — sign in again."
                : res.status === 413
                  ? `That file is over ${MAX_MB} MB.`
                  : `The upload failed (HTTP ${res.status}). Try again.`)
          )
          return
        }

        if (data.ocr) {
          toast.info(
            "That PDF had no selectable text, so it was read with OCR. Line references will point at the recovered text, not the printed page."
          )
        }

        setRun({
          id: data.runId,
          status: data.cached ? "succeeded" : "queued",
          currentStep: null,
          progress: [],
          error: null,
        })

        // A recognised resume skips the model entirely — go straight through.
        if (data.cached) {
          router.refresh()
          router.push("/app/map")
        }
      } catch {
        setError("Could not reach the server. Check your connection and retry.")
      } finally {
        setUploading(false)
      }
    },
    [router]
  )

  /** Validate before spending the user's bandwidth. */
  function choose(selected: File | undefined | null) {
    if (!selected || busy) return

    const looksPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf")
    if (!looksPdf) {
      setError("That's not a PDF. Export your resume as PDF, or paste the text.")
      return
    }
    if (selected.size > MAX_BYTES) {
      setError(
        `That file is over ${MAX_MB} MB. Most resumes are under 500 KB — try exporting again, or paste the text.`
      )
      return
    }

    setFile(selected)
    const body = new FormData()
    body.append("resume", selected)
    if (roleId) body.append("roleId", roleId)
    void submit(body)
  }

  function submitPaste() {
    if (busy) return
    const text = pastedText.trim()
    if (text.length < 200) {
      setError(
        `That's only ${text.length} characters — paste the whole resume so there's something to measure.`
      )
      return
    }
    const body = new FormData()
    body.append("text", text)
    if (roleId) body.append("roleId", roleId)
    void submit(body)
  }

  function retry() {
    if (busy) return
    setRun(null)
    if (mode === "paste") submitPaste()
    else if (file) choose(file)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Intake mode */}
      <div className="flex items-center gap-1 self-start rounded-full bg-white/5 p-0.5">
        {(["file", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50",
              mode === m ? "bg-paper text-void" : "text-fog hover:text-mist"
            )}
          >
            {m === "file" ? "Upload a PDF" : "Paste the text"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <SubCard
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            choose(e.dataTransfer.files?.[0])
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
                {file
                  ? file.name
                  : "Drop a PDF, or choose one — analysis starts right away"}
              </p>
              <p className="font-mono text-xs text-ash">
                {file
                  ? `${Math.round(file.size / 1024)} KB`
                  : `Up to ${MAX_MB} MB · text-based PDFs only`}
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
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
      ) : (
        <SubCard className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <ClipboardType className="size-5 text-fog" aria-hidden />
            <div>
              <p className="text-caption text-mist">Paste your resume text</p>
              <p className="font-mono text-xs text-ash">
                For scanned PDFs and image exports, which have no text to read
              </p>
            </div>
          </div>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={busy}
            rows={8}
            placeholder="Paste everything — sections, bullet points, dates."
            aria-label="Resume text"
            className="w-full resize-y rounded-md border border-graphite bg-white/[0.02] p-3 font-mono text-xs text-mist placeholder:text-ash focus-visible:border-mist focus-visible:outline-none"
          />
          <div className="flex items-center gap-3">
            <Button type="button" onClick={submitPaste} disabled={busy}>
              {busy ? "Analysing…" : "Analyse this text"}
            </Button>
            <span className="font-mono text-xs text-ash">
              {pastedText.trim().length.toLocaleString()} characters
            </span>
          </div>
        </SubCard>
      )}

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
          Gaps are measured against this role&rsquo;s benchmark. You can change
          it later without re-uploading.
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
                {run.currentStep
                  ? (STEP_LABEL[run.currentStep] ?? "Working")
                  : "Queued"}
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
            {active ? (
              <li className="flex items-center gap-2 font-mono text-xs text-ash">
                <span className="animate-pulse">•</span>
                Reading your resume — this can take a minute or two
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
                disabled={busy || (mode === "file" && !file)}
                onClick={retry}
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
