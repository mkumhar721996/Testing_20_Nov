// All formatting is in the browser's local time zone.
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatTime = (iso: string) => time.format(new Date(iso))

// "Mon 23 Nov 2026" (en-GB puts a comma after the weekday)
export const formatDate = (iso: string) => dateFmt.format(new Date(iso)).replace(',', '')

export function formatHours(fromIso: string, toIso: string) {
  const minutes = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000)
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} m`
}

export const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
