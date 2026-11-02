// Saving a log as a .log file, from the app's log view and the classic log
// page. The file holds the raw body exactly as Salesforce returned it, not
// the rendered or filtered lines.

export interface LogFileInfo {
  id: string
  // ApexLog.StartTime ("2026-10-12T08:15:30.000+0000"), if known.
  startTime?: string
  // ApexLog.Operation ("/apex/MyPage", "executeAnonymous"), if known.
  operation?: string
}

const MAX_OPERATION_LENGTH = 40

// "2026-10-12T08:15:30.000+0000" -> "2026-10-12T08-15-30Z" (UTC, no colons,
// which Windows doesn't allow in file names), or '' if it isn't a date.
export function fileTimestamp(startTime: string | undefined): string {
  if (!startTime) return ''
  const time = new Date(startTime.replace(/([+-]\d\d)(\d\d)$/, '$1:$2'))
  if (Number.isNaN(time.getTime())) return ''
  return time
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/:/g, '-')
}

// The last part of a page path ("/apex/MyPage" -> "MyPage"), reduced to
// characters that are safe in a file name on every system.
export function fileOperation(operation: string | undefined): string {
  if (!operation) return ''
  const parts = operation.split('/').filter(Boolean)
  const name = parts.length ? parts[parts.length - 1] : operation
  return name
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, MAX_OPERATION_LENGTH)
    .replace(/-+$/, '')
}

// "<start time>_<operation>_<id>.log", leaving out the parts not known:
// "2026-10-12T08-15-30Z_executeAnonymous_07LMK0000000001AAA.log".
export function logFileName({ id, startTime, operation }: LogFileInfo): string {
  const safeId = id.replace(/[^A-Za-z0-9]/g, '') || 'apex-log'
  return (
    [fileTimestamp(startTime), fileOperation(operation), safeId]
      .filter(Boolean)
      .join('_') + '.log'
  )
}

// Saves `text` as a file named `fileName` through a Blob URL and a
// temporary link (no extra permission needed).
export function saveTextFile(
  fileName: string,
  text: string,
  doc: Document = document
): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/plain;charset=utf-8' })
  )
  const link = doc.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  doc.body.appendChild(link)
  link.click()
  link.remove()
  // The download has started by then; the URL isn't needed any more.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
