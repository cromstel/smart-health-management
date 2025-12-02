import { describe, it, expect } from 'vitest'
import { formatIcalDate, generateIcsFile, downloadIcsFile } from './appointments'

describe('appointments utils', () => {
  it('formats iCal date correctly', () => {
    const d = new Date('2024-01-20T09:00:00')
    expect(formatIcalDate(d)).toBe('20240120T090000')
  })

  it('generates ICS content with expected fields', () => {
    const content = generateIcsFile({
      id: 'uuid1',
      patientName: 'Sarah Johnson',
      doctorName: 'Dr. Michael Chen',
      time: '09:00',
      date: '2024-01-20',
      department: 'Cardiology',
      type: 'Consultation',
      notes: 'Initial consultation',
    })
    expect(content).toContain('BEGIN:VCALENDAR')
    expect(content).toContain('SUMMARY:Consultation with Dr. Michael Chen')
    expect(content).toContain('LOCATION:Cardiology')
    expect(content).toContain('DESCRIPTION:Initial consultation')
    expect(content).toContain('Patient: Sarah Johnson')
  })

  it('downloads ICS file via anchor element', () => {
    const content = 'BEGIN:VCALENDAR\nEND:VCALENDAR'
    downloadIcsFile('test', content)
    const anchors = document.querySelectorAll('a[download="test.ics"]')
    expect(anchors.length).toBe(0)
  })
})

