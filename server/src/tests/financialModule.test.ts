import { describe, it, expect } from 'vitest'
import pool from '../config/database.js'
import { 
  getAccounts,
  createAccount,
  createTransaction,
  generateReport,
  exportPdf,
  exportExcel
} from '../controllers/financial.controller.js'

const makeRes = () => {
  const res: any = {}
  res.statusCode = 200
  res.status = (code: number) => { res.statusCode = code; return res }
  res.jsonData = undefined
  res.json = (data: any) => { res.jsonData = data; return res }
  // The export handlers stream a file back, so the mock needs the header and
  // body calls as well. Without them the export tests could not run at all.
  res.headers = {} as Record<string, string>
  res.setHeader = (name: string, value: string) => { res.headers[name] = value; return res }
  res.body = undefined
  res.send = (body: any) => { res.body = body; return res }
  res.sent = new Promise<void>((resolve) => { res.markSent = resolve })
  return res
}

let dbAvailable = false

// The database is probed before the suite is collected, not in a beforeAll.
// `it` / `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so the flag was still false at collection time
// and every test in this file was skipped -- the suite reported green while
// asserting nothing.
try {
  const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM accounts')
  dbAvailable = (rows as any)[0].cnt > 0
} catch (error) {
  console.warn('Financial Module tests skipped: Database not available', error instanceof Error ? error.message : String(error))
  dbAvailable = false
}

describe('Financial Module', () => {
  const skipIfNoDb = () => {
    if (!dbAvailable) {
      return it.skip
    }
    return it
  }

  skipIfNoDb()('lists accounts', async () => {
    const res = makeRes()
    await getAccounts({} as any, res)
    expect(Array.isArray(res.jsonData)).toBe(true)
    expect(res.jsonData.length).toBeGreaterThan(0)
  })

  skipIfNoDb()('creates an account', async () => {
    const req: any = { body: { accountName: 'Test Account', accountType: 'income' } }
    const res = makeRes()
    await createAccount(req, res)
    expect(res.statusCode).toBe(201)
    expect(res.jsonData.account_code).toMatch(/^ACC-/)
  })

  skipIfNoDb()('creates a transaction and updates balance', async () => {
    const [accRows] = await pool.query('SELECT id FROM accounts WHERE type="income" LIMIT 1')
    const accountId = (accRows as any)[0].id
    const req: any = { user: { id: 2 }, body: { accountId, transactionDate: '2025-01-01', description: 'Test', debit: 0, credit: 100 } }
    const res = makeRes()
    await createTransaction(req, res)
    expect(res.statusCode).toBe(201)
    expect(res.jsonData.transaction_id).toMatch(/^TRN-/)
  })

  skipIfNoDb()('generates balance sheet report', async () => {
    const req: any = { query: { reportType: 'balance_sheet', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    await generateReport(req, res)
    expect(res.jsonData.title).toBe('Balance Sheet')
    expect(res.jsonData.totals).toHaveProperty('totalAssets')
  })

  skipIfNoDb()('exports PDF', async () => {
    const req: any = { query: { reportType: 'income_statement', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    res.send = (body: any) => { res.body = body; res.markSent(); return res }
    await exportPdf(req, res)
    await res.sent
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toBe('application/pdf')
    // A PDF always starts with the %PDF- magic bytes.
    expect(Buffer.from(res.body).subarray(0, 4).toString()).toBe('%PDF')
  })

  skipIfNoDb()('exports Excel', async () => {
    const req: any = { query: { reportType: 'cash_flow', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    await exportExcel(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toContain('spreadsheetml')
    // An xlsx file is a zip archive, which starts with the PK signature.
    expect(Buffer.from(res.body).subarray(0, 2).toString()).toBe('PK')
  })
})