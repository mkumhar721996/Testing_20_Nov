const PATHS = {
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'arrow-left': ['m12 19-7-7 7-7', 'M19 12H5'],
  info: ['M12 16v-4', 'M12 8h.01'],
  alert: ['M12 8v4', 'M12 16h.01'],
  check: ['M20 6 9 17l-5-5'],
} as const

const CIRCLED = new Set(['info', 'alert'])

/** Decorative inline icon, sized by the `.icon` rule. */
export default function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CIRCLED.has(name) && <circle cx="12" cy="12" r="10" />}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
