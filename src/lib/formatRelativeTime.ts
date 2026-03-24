const MINUTE = 60
const HOUR = 3600
const DAY = 86400

/**
 * Format a date string as a human-readable relative time, e.g. "just now",
 * "5 minutes ago", "2 hours ago", "3 days ago", or a formatted date for > 7 days.
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = Date.now()
  const diffSeconds = Math.floor((now - date.getTime()) / 1000)

  if (diffSeconds < MINUTE) return 'just now'

  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }

  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }

  if (diffSeconds < DAY * 7) {
    const days = Math.floor(diffSeconds / DAY)
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }

  return `on ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`
}
