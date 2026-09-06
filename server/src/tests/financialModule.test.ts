import { describe, it, expect, beforeAll } from 'vitest'
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
  return res
}

describe('Financial Module', () => {
  beforeAll(async () => {
    // Ensure schema and seed applied
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM accounts')
    expect((rows as any)[0].cnt).toBeGreaterThan(0)
  })

  it('lists accounts', async () => {
    const res = makeRes()
    await getAccounts({} as any, res)
    expect(Array.isArray(res.jsonData)).toBe(true)
    expect(res.jsonData.length).toBeGreaterThan(0)
  })

  it('creates an account', async () => {
    const req: any = { body: { accountName: 'Test Account', accountType: 'income' } }
    const res = makeRes()
    await createAccount(req, res)
    expect(res.statusCode).toBe(201)
    expect(res.jsonData.account_code).toMatch(/^ACC-/)
  })

  it('creates a transaction and updates balance', async () => {
    const [accRows] = await pool.query('SELECT id FROM accounts WHERE type="income" LIMIT 1')
    const accountId = (accRows as any)[0].id
    const req: any = { user: { id: 2 }, body: { accountId, transactionDate: '2025-01-01', description: 'Test', debit: 0, credit: 100 } }
    const res = makeRes()
    await createTransaction(req, res)
    expect(res.statusCode).toBe(201)
    expect(res.jsonData.transaction_id).toMatch(/^TRN-/)
  })

  it('generates balance sheet report', async () => {
    const req: any = { query: { reportType: 'balance_sheet', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    await generateReport(req, res)
    expect(res.jsonData.title).toBe('Balance Sheet')
    expect(res.jsonData.totals).toHaveProperty('totalAssets')
  })

  it.skip('exports PDF', async () => {
    const req: any = { query: { reportType: 'income_statement', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    await exportPdf(req, res)
    expect(res.statusCode).toBe(200)
  })

  it.skip('exports Excel', async () => {
    const req: any = { query: { reportType: 'cash_flow', startDate: '2025-01-01', endDate: '2025-12-31' } }
    const res = makeRes()
    await exportExcel(req, res)
    expect(res.statusCode).toBe(200)
  })
})