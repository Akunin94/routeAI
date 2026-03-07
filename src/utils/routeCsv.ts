import type { Route } from '@/types/route'

const SEP = '\t'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function row(...values: (string | number)[]): string {
  return values.map(String).join(SEP)
}

export function buildRouteCsv(route: Route, departureTime?: string): string {
  const lines: string[] = []
  const date = new Date(route.createdAt).toLocaleDateString()

  // Summary
  lines.push('Route Export')
  lines.push(row('Total Distance', 'Total Duration', 'Date', 'Departure Time'))
  lines.push(row(route.totalDistance.text, route.totalDuration.text, date, departureTime ?? ''))
  lines.push('')

  // Waypoints with coordinates
  lines.push('Waypoints')
  lines.push(row('#', 'Label', 'Address', 'Lat', 'Lng'))
  for (const [i, wp] of route.waypoints.entries()) {
    lines.push(row(i + 1, wp.label, wp.address, wp.location.lat, wp.location.lng))
  }
  lines.push('')

  // Step-by-step instructions
  lines.push('Route Steps')
  lines.push(row('Leg', 'From', 'To', 'Leg Distance', 'Leg Duration', 'Step #', 'Instruction', 'Step Distance', 'Step Duration'))
  for (const [legIdx, leg] of route.legs.entries()) {
    for (const [stepIdx, step] of leg.steps.entries()) {
      lines.push(row(
        legIdx + 1,
        leg.startAddress,
        leg.endAddress,
        leg.distance.text,
        leg.duration.text,
        stepIdx + 1,
        stripHtml(step.instruction),
        step.distance,
        step.duration,
      ))
    }
  }

  return lines.join('\n')
}

export function downloadRouteCsv(route: Route, departureTime?: string, filename = 'route.tsv'): void {
  const content = buildRouteCsv(route, departureTime)
  // BOM for correct UTF-8 in Excel/Numbers
  const blob = new Blob(['\ufeff' + content], { type: 'text/tab-separated-values;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
