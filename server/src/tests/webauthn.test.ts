import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import type { AuthRequest } from '../middleware/auth.js'
import * as webauthnController from '../controllers/webauthn.controller.js'
import { signChallenge, verifyChallenge, sanitizeDeviceName, getRpConfig, userHandleFor } from '../utils/webauthn.js'
import { getSecret } from '../config/env.js'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn()
    }
  }
})

vi.mock('@simplewebauthn/server', () => {
  return {
    generateRegistrationOptions: vi.fn().mockResolvedValue({ challenge: 'signed-challenge' }),
    generateAuthenticationOptions: vi.fn().mockResolvedValue({ challenge: 'assert-challenge' }),
    verifyRegistrationResponse: vi.fn(),
    verifyAuthenticationResponse: vi.fn()
  }
})

const pool: any = (await import('../config/database.js')).default
const serverPkg: any = await import('@simplewebauthn/server')

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.statusCode = 200
  return res
}

/**
 * Deterministic mock state per test: resetAllMocks clears calls AND any
 * leftover mockResolvedValueOnce queues from the previous test, then we
 * re-apply the default ceremony implementations.
 */
beforeEach(() => {
  vi.resetAllMocks()
  serverPkg.generateRegistrationOptions.mockResolvedValue({ challenge: 'signed-challenge' })
  serverPkg.generateAuthenticationOptions.mockResolvedValue({ challenge: 'assert-challenge' })
  serverPkg.verifyRegistrationResponse.mockResolvedValue({ verified: false })
  serverPkg.verifyAuthenticationResponse.mockResolvedValue({ verified: false })
})

function authReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin', role_id: 2 },
    body: {},
    params: {},
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('vitest'),
    ...overrides
  } as unknown as AuthRequest
}

const credentialRow = {
  id: 7,
  user_id: 1,
  credential_id: 'cred-id-b64',
  public_key: 'cHVibGljLWtleS1jb3Nl',
  counter: 3,
  device_name: 'Windows Hello',
  transports: null,
  created_at: new Date(),
  last_used_at: null
}

describe('webauthn utils', () => {
  it('getRpConfig falls back to localhost defaults without env', () => {
    const rp = getRpConfig()
    expect(rp.id).toBe('localhost')
    expect(rp.name).toBeTruthy()
    expect(rp.origin).toBeTruthy()
  })

  it('userHandleFor is stable and 16 bytes', () => {
    const a = userHandleFor(1)
    const b = userHandleFor(1)
    expect(a).toEqual(b)
    expect(a).toHaveLength(16)
  })

  it('signChallenge/verifyChallenge round-trips', () => {
    const token = signChallenge('abc123')
    expect(verifyChallenge(token)).toBe('abc123')
  })

  it('verifyChallenge rejects tampered tokens and wrong purpose', () => {
    const token = signChallenge('abc123')
    const [head, , tail] = token.split('.')
    expect(verifyChallenge(`${head}.${Buffer.from('{}').toString('base64url')}.${tail}`)).toBeNull()
    expect(verifyChallenge('garbage')).toBeNull()
    const wrong = jwt.sign({ purpose: 'other', challenge: 'abc123' }, getSecret('JWT_SECRET', 'dev-only-jwt-secret'), { expiresIn: 60 })
    expect(verifyChallenge(wrong)).toBeNull()
  })

  it('verifyChallenge rejects expired tokens', () => {
    const expired = jwt.sign(
      { purpose: 'webauthn-challenge', challenge: 'old' },
      getSecret('JWT_SECRET', 'dev-only-jwt-secret'),
      { expiresIn: -1 } as jwt.SignOptions
    )
    expect(verifyChallenge(expired)).toBeNull()
  })

  it('sanitizeDeviceName trims, strips control chars, caps length, falls back', () => {
    expect(sanitizeDeviceName(' Windows Hello ')).toBe('Windows Hello')
    expect(sanitizeDeviceName('a\u0000b<c>')).toBe('abc')
    expect(sanitizeDeviceName('x'.repeat(200))).toHaveLength(120)
    expect(sanitizeDeviceName(undefined)).toBe('Passkey')
    expect(sanitizeDeviceName('   ')).toBe('Passkey')
  })
})

describe('webauthn registerOptions', () => {

  it('rejects without an authenticated user', async () => {
    const res = mockRes()
    await webauthnController.registerOptions({} as AuthRequest, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
  })

  it('returns signed options + challenge token for an authenticated user', async () => {
    const res = mockRes()
    await webauthnController.registerOptions(authReq(), res as any)
    expect(serverPkg.generateRegistrationOptions).toHaveBeenCalled()
    const payload = res.json.mock.calls[0][0]
    expect(payload.options.challenge).toBe('signed-challenge')
    expect(verifyChallenge(payload.challengeToken)).toBe('signed-challenge')
  })
})

describe('webauthn registerVerify', () => {

  it('rejects without an authenticated user', async () => {
    const res = mockRes()
    await webauthnController.registerVerify({} as AuthRequest, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects when challengeToken is missing', async () => {
    const res = mockRes()
    await webauthnController.registerVerify(authReq({ body: { registration: {} } }), res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid registration request' })
  })

  it('rejects an expired or invalid challenge token', async () => {
    const res = mockRes()
    const req = authReq({
      body: { registration: {}, challengeToken: 'expired-token' },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.registerVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Challenge is invalid or has expired. Please try again.' })
  })

  it('rejects failed attestation verification', async () => {
    serverPkg.verifyRegistrationResponse.mockResolvedValueOnce({ verified: false })
    pool.query.mockResolvedValueOnce([[]])
    const res = mockRes()
    const req = authReq({
      body: { registration: {}, challengeToken: signChallenge('challenge-1') },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.registerVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a duplicate credential id', async () => {
    serverPkg.verifyRegistrationResponse.mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-id-b64', publicKey: new Uint8Array([1, 2, 3]), counter: 1 },
        userVerified: true
      }
    })
    pool.query.mockResolvedValueOnce([[{ id: 9 }]]) // existing credential
    const res = mockRes()
    const req = authReq({
      body: { registration: {}, challengeToken: signChallenge('challenge-1') },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.registerVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'This passkey is already registered on your account.' })
  })

  it('persists a verified credential and logs the audit event', async () => {
    serverPkg.verifyRegistrationResponse.mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-id-b64', publicKey: new Uint8Array([1, 2, 3, 4]), counter: 2 },
        userVerified: true
      }
    })
    pool.query
      .mockResolvedValueOnce([[]]) // duplicate check
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT credential
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // audit INSERT
    const res = mockRes()
    const req = authReq({
      body: { registration: { response: { transports: ['internal'] } }, challengeToken: signChallenge('challenge-1'), deviceName: 'FaceID' },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.registerVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ message: 'Passkey registered successfully' })

    const insert = pool.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO webauthn_credentials'))
    expect(insert).toBeTruthy()
    expect(insert[1][0]).toBe('1')
    expect(insert[1][1]).toBe('cred-id-b64') // base64url credential id kept verbatim
    expect(insert[1][2]).toBe('AQIDBA') // public key (1,2,3,4) → base64url (no padding)
    expect(insert[1][3]).toBe(2)
    expect(insert[1][4]).toBe('FaceID')

    const audit = pool.query.mock.calls.find((c: any[]) => c[0].includes('mfa_passkey_registered'))
    expect(audit).toBeTruthy()
    expect(JSON.parse(audit[1][1])).toEqual({ device: 'FaceID' })
  })
})

describe('webauthn loginOptions', () => {

  it('rejects a missing/invalid email', async () => {
    const res = mockRes()
    await webauthnController.loginOptions(authReq({ body: {} }), res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'A valid email address is required' })
  })

  it('404s for an unknown account', async () => {
    pool.query.mockResolvedValueOnce([[]])
    const res = mockRes()
    await webauthnController.loginOptions(authReq({ body: { email: 'nobody@example.com' } }), res as any)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'No account found for that email' })
  })

  it('400s when the account has no passkeys', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // user exists
      .mockResolvedValueOnce([[]]) // zero credentials
    const res = mockRes()
    await webauthnController.loginOptions(authReq({ body: { email: 'admin@smarthealth.com' } }), res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'This account has no registered passkeys' })
  })

  it('returns allowCredentials + signed challenge for a real account', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ credential_id: 'cred-a' }, { credential_id: 'cred-b' }]])
    const res = mockRes()
    await webauthnController.loginOptions(authReq({ body: { email: 'admin@smarthealth.com' } }), res as any)
    const payload = res.json.mock.calls[0][0]
    const { allowCredentials } = serverPkg.generateAuthenticationOptions.mock.calls[0][0]
    expect(allowCredentials.map((c: any) => c.id)).toEqual(['cred-a', 'cred-b'])
    expect(verifyChallenge(payload.challengeToken)).toBe('assert-challenge')
  })
})

describe('webauthn loginVerify', () => {

  it('rejects without an authenticated user', async () => {
    const res = mockRes()
    await webauthnController.loginVerify({} as AuthRequest, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects an invalid challenge token', async () => {
    const res = mockRes()
    const req = authReq({ body: { assertion: {}, challengeToken: 'bad' } })
    await webauthnController.loginVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Challenge is invalid or has expired. Please try again.' })
  })

  it('rejects an assertion with no matching stored credential', async () => {
    pool.query.mockResolvedValueOnce([[]])
    const res = mockRes()
    const req = authReq({
      body: { assertion: { id: 'unknown-cred' }, challengeToken: signChallenge('challenge-1') },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.loginVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'No matching passkey for this account' })
  })

  it('rejects a failed assertion verification', async () => {
    pool.query.mockResolvedValueOnce([[credentialRow]])
    serverPkg.verifyAuthenticationResponse.mockResolvedValueOnce({ verified: false })
    const res = mockRes()
    const req = authReq({
      body: { assertion: { id: 'cred-id-b64' }, challengeToken: signChallenge('challenge-1') },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.loginVerify(req, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Passkey assertion could not be verified.' })
  })

  it('issues a full session on a verified assertion, bumps counter, and audits', async () => {
    pool.query
      .mockResolvedValueOnce([[credentialRow]]) // SELECT credential
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE counter
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // audit INSERT
      .mockResolvedValueOnce([[{ ...credentialRow, id: 1, name: 'Admin User', email: 'admin@smarthealth.com', password_must_change: 0, hospital_code: 'HOSP-001' }]]) // SELECT user (join)
      .mockResolvedValueOnce([[{ name: 'Admin' }]]) // SELECT role
      .mockResolvedValueOnce([[{ module: 'users', can_view: 1, can_add: 0, can_edit: 0, can_delete: 0 }]]) // SELECT perms
    serverPkg.verifyAuthenticationResponse.mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { credentialID: 'cred-id-b64', newCounter: 4, userVerified: true }
    })
    const res = mockRes()
    const req = authReq({
      body: { assertion: { id: 'cred-id-b64' }, challengeToken: signChallenge('challenge-1') },
      headers: { 'user-agent': 'vitest' }
    })
    await webauthnController.loginVerify(req, res as any)

    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('token')
    expect(payload.user).toMatchObject({ id: 1, email: 'admin@smarthealth.com', role: 'Admin', hospital_id: 'HOSP-001' })
    expect(payload.user.permissions).toContain('users:view')

    const update = pool.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE webauthn_credentials'))
    expect(update[1][0]).toBe(4) // newCounter persisted
    expect(update[1][1]).toBe(7)

    const audit = pool.query.mock.calls.find((c: any[]) => c[0].includes('mfa_passkey_used'))
    expect(audit).toBeTruthy()
    expect(JSON.parse(audit[1][1])).toEqual({ device: 'Windows Hello' })
  })
})

describe('webauthn credential management', () => {

  it('listCredentials rejects unauthenticated requests', async () => {
    const res = mockRes()
    await webauthnController.listCredentials({} as AuthRequest, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('listCredentials returns the caller credentials', async () => {
    pool.query.mockResolvedValueOnce([[credentialRow]])
    const res = mockRes()
    await webauthnController.listCredentials(authReq(), res as any)
    expect(res.json).toHaveBeenCalledWith({ credentials: [credentialRow] })
    expect(pool.query.mock.calls[0][1]).toEqual(['1'])
  })

  it('deleteCredential rejects non-numeric ids', async () => {
    const res = mockRes()
    await webauthnController.deleteCredential(authReq({ params: { id: 'abc' } }), res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid passkey id' })
  })

  it('deleteCredential 404s when nothing was deleted', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }])
    const res = mockRes()
    await webauthnController.deleteCredential(authReq({ params: { id: '99' } }), res as any)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('deleteCredential removes the row and audits', async () => {
    pool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const res = mockRes()
    const req = authReq({ params: { id: '7' }, headers: { 'user-agent': 'vitest' } })
    await webauthnController.deleteCredential(req, res as any)
    expect(res.json).toHaveBeenCalledWith({ message: 'Passkey removed' })
    expect(pool.query.mock.calls[0][1]).toEqual([7, '1'])
    const audit = pool.query.mock.calls.find((c: any[]) => c[0].includes('mfa_passkey_removed'))
    expect(audit).toBeTruthy()
    expect(JSON.parse(audit[1][1])).toEqual({ credentialId: 7 })
  })
})