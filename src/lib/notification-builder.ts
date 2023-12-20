import { differenceInDays, differenceInMinutes, format } from 'date-fns'
import sv from 'date-fns/locale/sv'

export function getNotificationTitle (calendar_name: string) {
    return calendar_name === 'Friträning' ? 'Ny friträning bokad!' : `${calendar_name} uppdaterad`
}
export function getNotificationBody (start: Date, end: Date) {
    const date = format(start, 'do MMMM', { locale: sv })
    const hhmm = format(start, 'HH:mm', { locale: sv })
    const hhmm_end = format(end, 'HH:mm', { locale: sv })
    const inDays = differenceInDays(start, new Date())
    const weekday = format(start, 'EEEE', { locale: sv }).replace(/^./, s => s.toUpperCase())
    const duration = differenceInMinutes(end, start)

    const suffix = `kl ${hhmm}-${hhmm_end}, ${duration} min`
    if (inDays < 7) {
        return `${weekday}, ${suffix}`
    } else {
        return `${weekday}, ${date}\n${suffix}`
    }
}
