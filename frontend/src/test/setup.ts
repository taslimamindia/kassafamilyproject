import { afterEach, beforeAll, vi } from 'vitest'

// Ensure a predictable environment for tests
beforeAll(() => {
    // Spy-friendly location.assign
    if (typeof window !== 'undefined') {
        const originalAssign = window.location.assign
        Object.defineProperty(window, 'location', {
            value: { ...window.location, assign: vi.fn(originalAssign as any) },
            writable: true,
        })
    }
})

afterEach(() => {
    try { localStorage.clear() } catch { }
    vi.restoreAllMocks()
})
