import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { login, verifyToken, logout } from '../auth'

const IDENTIFIER = process.env.TEST_IDENTIFIER
const PASSWORD = process.env.TEST_PASSWORD

const shouldRun = Boolean(IDENTIFIER && PASSWORD)

// These tests hit the real backend defined by VITE_API_BASE_URL.
// They are skipped unless TEST_IDENTIFIER and TEST_PASSWORD are provided.
describe.skipIf(!shouldRun)('auth service integration', () => {
    beforeAll(() => {
        try { localStorage.clear() } catch { }
    })

    afterAll(() => {
        try { localStorage.clear() } catch { }
    })

    it('logs in with identifier/password and stores token', async () => {
        const token = await login(IDENTIFIER!, PASSWORD!)
        expect(typeof token).toBe('string')
        expect(token.length).toBeGreaterThan(10)
        expect(localStorage.getItem('access_token')).toBe(token)
    })

    it('verifies token via /auth/verify', async () => {
        const ok = await verifyToken()
        expect(ok).toBe(true)
    })

    it('logs out and clears token', async () => {
        await logout()
        expect(localStorage.getItem('access_token')).toBeNull()
    })
})
