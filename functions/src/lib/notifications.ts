import { differenceInDays, differenceInMinutes, format } from 'date-fns'
import { sv } from 'date-fns/locale/sv'
import { Message, Messaging } from 'firebase-admin/messaging'
import { ICalEvent } from 'ical-generator'
import { Calendars } from './types'
import { logger } from '../logging'
import { pick } from 'lodash'
import { Clock } from './clock'

function getNotificationTitle(title: string, calendarId: string, creator?: string): string {
    if (title.toLocaleLowerCase().includes('medlemsträning')) {
        return creator ? `${creator} har bokat en medlemsträning!` : `Ny medlemsträning bokad!`
    }
    if (title.toLocaleLowerCase().includes('tematräning')) {
        return creator ? `${creator} har bokat en tematräning!` : `Ny tematräning bokad!`
    }
    return calendarId === '337667'
        ? (creator ? `${creator} har bokat en öppen träning!` : `Ny öppen träning bokad!`)
        : `Ny bokning i ${calendarId}`
}

function getNotificationBody(clock: Clock, start: Date, end: Date): string {
    // Dates are timeone formatted upstream
    const date = format(start, 'do MMMM', { locale: sv })
    const hhmm = format(start, 'HH:mm', { locale: sv })
    const hhmm_end = format(end, 'HH:mm', { locale: sv })

    const weekday = format(start, 'EEEE', { locale: sv }).replace(/^./, s => s.toUpperCase())
    const duration = differenceInMinutes(end, start)
    const inDays = differenceInDays(start, clock.now())

    const suffix = `kl ${hhmm}-${hhmm_end}, ${duration} min`
    if (inDays < 7) {
        return `${weekday}, ${suffix}`
    }
    else {
        return `${weekday}, ${date}\n${suffix}`
    }
}

export type Notification = Required<Pick<Exclude<Message['notification'], undefined>, 'body' | 'title'>>

export class Notifications {
    messaging: Messaging

    constructor(messaging: Messaging) {
        this.messaging = messaging
    }

    async send(clock: Clock, event: ICalEvent, creator: string | undefined, cal: Calendars[number]): Promise<Notification> {
        const topicName = `calendar-${cal.id}`
        const notification: Notification = {
            title: getNotificationTitle(event.summary(), cal.id, creator),
            body: getNotificationBody(clock, event.start() as Date, event.end() as Date),
        }
        const message: Message = {
            notification,
            webpush: {
                notification: {
                    tag: 'nsw-' + topicName,
                    icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg'
                }
            },
            topic: topicName,
            data: {
                nsw_topic: topicName,
                nsw_subject_id: event.uid()
            }
        }
        logger.info(cal, 'Sending notification for new event! %o', {
            notification: message.notification,
            event: pick(event.toJSON(), 'id', 'start', 'summary', 'description')
        })

        const id = await this.messaging.send(message)
        logger.info(cal, 'Sent notification %s', id)

        return notification
    }
}
