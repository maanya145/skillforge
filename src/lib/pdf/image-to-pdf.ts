import { PDFDocument } from "pdf-lib"

/**
 * Wraps a photo into a one-page PDF, losslessly.
 *
 * The OCR service accepts PDFs but not raw images, so a phone photo of a
 * resume needs a container, not a conversion — the image bytes are embedded
 * as-is and the page is sized to the image, so nothing is rescaled or
 * recompressed before OCR sees it.
 */
export async function wrapImageAsPdf(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/jpeg"
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const image =
    mimeType === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  const page = doc.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  return doc.save()
}

/** The image types the intake accepts. WebP/HEIC are out: pdf-lib can't embed them. */
export function imageMimeFor(file: {
  type: string
  name: string
}): "image/png" | "image/jpeg" | null {
  const name = file.name.toLowerCase()
  if (file.type === "image/png" || name.endsWith(".png")) return "image/png"
  if (
    file.type === "image/jpeg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  )
    return "image/jpeg"
  return null
}
