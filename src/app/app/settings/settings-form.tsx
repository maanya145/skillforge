"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SubCard } from "@/components/shell/frame"
import {
  updateProfile,
  setWeeklyHours,
  switchTargetRole,
} from "@/app/app/actions"

type Props = {
  fullName: string
  college: string
  gradYear: number | null
  weeklyHours: number
  targetRoleId: string | null
  roles: { id: string; name: string }[]
  hasAnalysis: boolean
}

export function SettingsForm(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SubCard>
        <span className="t-micro">Profile</span>
        <form
          className="mt-3 flex flex-col gap-3"
          action={(formData) => run(() => updateProfile(formData))}
        >
          <Field label="Full name" htmlFor="fullName">
            <Input
              id="fullName"
              name="fullName"
              defaultValue={props.fullName}
              placeholder="As it appears on your resume"
              maxLength={80}
            />
          </Field>
          <Field label="College" htmlFor="college">
            <Input
              id="college"
              name="college"
              defaultValue={props.college}
              placeholder="Institution"
              maxLength={120}
            />
          </Field>
          <Field label="Graduation year" htmlFor="gradYear">
            <Input
              id="gradYear"
              name="gradYear"
              type="number"
              min={2020}
              max={2035}
              defaultValue={props.gradYear ?? undefined}
              placeholder="2026"
              className="w-28"
            />
          </Field>
          <Button type="submit" disabled={pending} className="self-start">
            Save profile
          </Button>
        </form>
      </SubCard>

      <div className="flex flex-col gap-4">
        <SubCard>
          <span className="t-micro">Target role</span>
          <p className="mt-2 text-xs text-fog">
            Everything is measured against this role&rsquo;s benchmark.
            Changing it re-scores your existing analysis — no re-upload.
          </p>
          <div className="mt-3">
            <Select
              defaultValue={props.targetRoleId ?? undefined}
              disabled={pending || !props.hasAnalysis}
              onValueChange={(roleId) => run(() => switchTargetRole(roleId))}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Pick a role" />
              </SelectTrigger>
              <SelectContent>
                {props.roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!props.hasAnalysis ? (
            <p className="mt-2 text-xs text-ash">
              Upload a resume first — the role picker re-scores an existing
              analysis.
            </p>
          ) : null}
        </SubCard>

        <SubCard>
          <span className="t-micro">Weekly study budget</span>
          <p className="mt-2 text-xs text-fog">
            Drives every weeks-to-close estimate and the roadmap schedule.
          </p>
          <div className="mt-3">
            <Select
              defaultValue={String(props.weeklyHours)}
              disabled={pending}
              onValueChange={(v) => run(() => setWeeklyHours(Number(v)))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 9, 14, 20].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h} hours / week
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SubCard>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-fog">
        {label}
      </Label>
      {children}
    </div>
  )
}
