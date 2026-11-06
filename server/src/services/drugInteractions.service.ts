import pool from '../config/database.js'

export type InteractionSeverity = 'high' | 'medium' | 'low'

export type InteractionRule = {
  id: number | string
  category_a: string
  category_b: string
  severity: InteractionSeverity
  description?: string
}

/**
 * `contraindications.severity` is an ENUM('low','moderate','high'). The rest
 * of the application speaks in 'medium', so the stored 'moderate' value is
 * mapped onto 'medium' here. Without the mapping a moderate interaction was
 * silently reported as 'none'.
 */
const normalizeSeverity = (value: unknown): InteractionSeverity => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'moderate' || raw === 'medium') return 'medium'
  if (raw === 'high') return 'high'
  return 'low'
}

export async function getInteractionsForCategory(category: string): Promise<InteractionRule[]> {
  if (!category) return []
  const [rows] = await pool.query('SELECT * FROM contraindications WHERE category_a = ? OR category_b = ?', [category, category])
  return (rows as any[]).map((row) => ({
    ...row,
    severity: normalizeSeverity(row.severity),
  }))
}

export async function validatePrescription(params: { patient_id: string | number, medicine_category: string }): Promise<{ severity: 'none' | 'low' | 'medium' | 'high', conflicts: InteractionRule[] }> {
  const rules = await getInteractionsForCategory(params.medicine_category)
  if (!rules.length) return { severity: 'none', conflicts: [] }
  // Find patient active prescriptions and categories
  const [pres] = await pool.query('SELECT p.*, mi.category as existing_category FROM prescriptions p JOIN medicines_inventory mi ON mi.id = p.medicine_id WHERE p.patient_id = ? AND p.status IN (\'new\', \'dispensed\')', [params.patient_id])
  // Categories are compared case insensitively: the inventory category is free
  // text, so 'nsaid' and 'NSAID' have to describe the same class.
  const categories = new Set<string>((pres as any[]).map((p) => String(p.existing_category ?? '').trim().toLowerCase()).filter(Boolean))
  const matches = (value: string) => categories.has(String(value ?? '').trim().toLowerCase())
  const conflicts = rules.filter((r) => matches(r.category_a) || matches(r.category_b))
  const sev = conflicts.reduce<'none' | 'low' | 'medium' | 'high'>((acc, c) => {
    const s = c.severity
    if (s === 'high') return 'high'
    if (s === 'medium') return acc === 'high' ? 'high' : 'medium'
    if (s === 'low') return acc === 'none' ? 'low' : acc
    return acc
  }, 'none')
  return { severity: sev, conflicts }
}
