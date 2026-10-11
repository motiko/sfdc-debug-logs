import { describe, it, expect, vi } from 'vitest'
import { cached } from './cached'

function memory(items: Record<string, string> = {}) {
  return {
    items,
    getItem: (k: string) => (k in items ? items[k] : null),
    setItem: (k: string, v: string) => void (items[k] = v)
  }
}

describe('cached', () => {
  it('loads once, then answers from storage until it expires', async () => {
    const storage = memory()
    const load = vi.fn(async () => ['001', '003'])
    let time = 1000
    const now = () => time
    expect(await cached(storage, 'k', 100, load, now)).toEqual(['001', '003'])
    time = 1050
    expect(await cached(storage, 'k', 100, load, now)).toEqual(['001', '003'])
    expect(load).toHaveBeenCalledTimes(1)
    time = 1100
    await cached(storage, 'k', 100, load, now)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads corrupt entries and survives storage errors', async () => {
    const load = vi.fn(async () => 42)
    expect(await cached(memory({ k: '{oops' }), 'k', 100, load)).toBe(42)
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      }
    }
    expect(await cached(broken, 'k', 100, load)).toBe(42)
    expect(await cached(undefined, 'k', 100, load)).toBe(42)
  })

  it('does not cache failures', async () => {
    const storage = memory()
    await expect(
      cached(storage, 'k', 100, () => Promise.reject(new Error('down')))
    ).rejects.toThrow('down')
    expect(storage.items).toEqual({})
  })
})
