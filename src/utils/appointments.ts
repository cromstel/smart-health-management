export function formatIcalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hour}${minute}${second}`
}

export function generateIcsFile(appointment: {
  id: string
  patientName: string
  doctorName: string
  time: string
  date: string
  department: string
  type: string
  notes: string
}): string {
  const { patientName, doctorName, time, date, department, type, notes } = appointment
  const startTime = new Date(`${date}T${time}:00`)
  const endTime = new Date(startTime.getTime() + 30 * 60000)
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Smart Health Manager//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${appointment.id}@smarthealthmanager.com
DTSTART:${formatIcalDate(startTime)}
DTEND:${formatIcalDate(endTime)}
SUMMARY:${type} with ${doctorName}
LOCATION:${department}
DESCRIPTION:${notes}\\nPatient: ${patientName}
END:VEVENT
END:VCALENDAR`
  return icsContent
}

export function downloadIcsFile(filename: string, content: string) {
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/calendar;charset=utf-8,' + encodeURIComponent(content))
  element.setAttribute('download', filename + '.ics')
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

