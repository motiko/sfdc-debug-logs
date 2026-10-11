// Turns a failed Salesforce call into something to tell the user: the likely
// cause in plain language, and the technical detail for a collapsible
// section. Used by the app's inline error panels (and meant for the content
// scripts' messages).

export type ErrorKind =
  'session' | 'permission' | 'network' | 'notFound' | 'other'

export interface ExplainedError {
  kind: ErrorKind
  // One sentence: what happened.
  title: string
  // What the user can do about it.
  hint: string
  // The raw message, for "Details".
  detail: string
}

export function explainError(
  error: unknown,
  host?: string | null
): ExplainedError {
  const err = (error || {}) as {
    status?: number
    message?: string
    name?: string
  }
  const detail = String(err.message || error || 'Unknown error')
  const org = host || 'the org'
  if (err.status === 401) {
    return {
      kind: 'session',
      title: 'Your Salesforce session has expired.',
      hint: `Sign in to ${org} again, then retry.`,
      detail
    }
  }
  if (err.status === 403) {
    return {
      kind: 'permission',
      title: "Your user isn't allowed to do this.",
      hint: 'Reading and deleting debug logs needs the "View All Data" or "Manage Users" permission and API access.',
      detail
    }
  }
  if (err.status === 404) {
    return {
      kind: 'notFound',
      title: 'Salesforce could not find it. It may have been deleted.',
      hint: 'Refresh the list of logs.',
      detail
    }
  }
  if (
    err.name === 'TypeError' ||
    /failed to fetch|networkerror|network error|load failed/i.test(detail)
  ) {
    return {
      kind: 'network',
      title: `Can't reach ${org}.`,
      hint: 'Check your connection or VPN, and that the org is up, then retry.',
      detail
    }
  }
  return {
    kind: 'other',
    title: 'Salesforce returned an error.',
    hint: 'Retry. If it keeps failing, the details below may help.',
    detail
  }
}
