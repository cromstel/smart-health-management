import pool from '../config/database.js'

export type InteractionRule = {
  id: string
  category_a: string
  category_b: string
  severity: 'high' | 'medium' | 'low'
  description?: string
}

export async function getInteractionsForCategory(category: string): Promise<InteractionRule[]> {
  const [rows] = await pool.query('SELECT * FROM contraindications WHERE category_a = ? OR category_b = ?', [category, category])
  return rows as InteractionRule[]
}

export async function validatePrescription(params: { patient_id: string | number, medicine_category: string }): Promise<{ severity: 'none' | 'low' | 'medium' | 'high', conflicts: InteractionRule[] }> {
  const rules = await getInteractionsForCategory(params.medicine_category)
  if (!rules.length) return { severity: 'none', conflicts: [] }
  // Find patient active prescriptions and categories
  const [pres] = await pool.query('SELECT p.*, mi.category as existing_category FROM prescriptions p JOIN medicines_inventory mi ON mi.id = p.medicine_id WHERE p.patient_id = ? AND p.status IN (\'new\', \'dispensed\')', [params.patient_id])
  const categories = new Set<string>((pres as any[]).map((p) => String(p.existing_category)))
  const conflicts = rules.filter((r) => categories.has(r.category_a) || categories.has(r.category_b))
  const sev = conflicts.reduce<'none' | 'low' | 'medium' | 'high'>((acc, c) => {
    const s = c.severity
    if (s === 'high') return 'high'
    if (s === 'medium') return acc === 'high' ? 'high' : 'medium'
    if (s === 'low') return acc === 'none' ? 'low' : acc
    return acc
  }, 'none')
  return { severity: sev, conflicts }
}