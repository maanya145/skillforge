import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { db, schema } from "@/db"
import { isClerkConfigured } from "@/lib/auth-config"

export type Student = typeof schema.students.$inferSelect

/**
 * The signed-in student's row, created on first sight.
 *
 * Clerk owns identity; this table owns everything about the student as a
 * *student* — target role, weekly hours, horizon. Splitting them means the auth
 * provider can be swapped without touching the domain model.
 *
 * Throws rather than returning null when there is no session. Every caller
 * needs a student to do anything useful, and a silent null is how data from one
 * account ends up rendered under another.
 */
export async function ensureStudent(): Promise<Student> {
  if (!isClerkConfigured) {
    throw new Error(
      "Auth is not configured. Run `vercel install clerk` and `vercel env pull .env.local`."
    )
  }

  const { userId } = await auth()
  if (!userId) throw new Error("Not signed in.")

  const [existing] = await db
    .select()
    .from(schema.students)
    .where(eq(schema.students.clerkUserId, userId))

  if (existing) return existing

  const user = await currentUser()

  const [created] = await db
    .insert(schema.students)
    .values({
      clerkUserId: userId,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
      fullName:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null,
      // Backend engineer is the default target simply because it's the role
      // with the most complete benchmark. The intake screen lets it change.
      targetRoleId: "backend-engineer",
    })
    .onConflictDoNothing({ target: schema.students.clerkUserId })
    .returning()

  if (created) return created

  // A concurrent request won the insert — read it back.
  const [raced] = await db
    .select()
    .from(schema.students)
    .where(eq(schema.students.clerkUserId, userId))
  if (!raced) throw new Error("Could not create the student record.")
  return raced
}

/** Available target roles, for the role picker. */
export async function listRoles() {
  return db.select().from(schema.roles).orderBy(schema.roles.sortOrder)
}
