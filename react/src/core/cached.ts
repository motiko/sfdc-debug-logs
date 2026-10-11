// A value that rarely changes, cached in a Storage (a Salesforce page's
// localStorage) for `maxAgeMs`, so content scripts don't ask Salesforce for it
// on every page load. Corrupt or old entries are loaded again; storage errors
// only cost the cache.
export async function cached<T>(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  key: string,
  maxAgeMs: number,
  load: () => Promise<T>,
  now = Date.now
): Promise<T> {
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null')
    if (
      saved &&
      typeof saved.at === 'number' &&
      now() - saved.at >= 0 &&
      now() - saved.at < maxAgeMs &&
      'value' in saved
    ) {
      return saved.value as T
    }
  } catch {
    // Load it below.
  }
  const value = await load()
  try {
    storage?.setItem(key, JSON.stringify({ at: now(), value }))
  } catch {
    // Not cached.
  }
  return value
}
