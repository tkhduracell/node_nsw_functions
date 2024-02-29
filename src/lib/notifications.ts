import { differenceInDays, differenceInMinutes, format } from 'date-fns'
import Swedish from 'date-fns/locale/sv'
import { Message, Messaging } from 'firebase-admin/messaging'
import { ICalEvent } from 'ical-generator'
import { Calendars } from './types'
import { logger } from '../logging'
import { pick } from 'lodash'
import { Clock } from './clock'

function getNotificationTitle(calendar_name: string, creator?: string) {
    return calendar_name === 'Friträning' ?
        (creator ? `${creator} har bokat en friträning!` : `Ny friträning bokad!`) :
        `Ny bokning i ${calendar_name}`
}

function getNotificationBody(clock: Clock, start: Date, end: Date) {
    // Dates are timeone formatted upstream
    const date = format(start, 'do MMMM', { locale: Swedish })
    const hhmm = format(start, 'HH:mm', { locale: Swedish })
    const hhmm_end = format(end, 'HH:mm', { locale: Swedish })

    const weekday = format(start, 'EEEE', { locale: Swedish }).replace(/^./, s => s.toUpperCase())
    const duration = differenceInMinutes(end, start)
    const inDays = differenceInDays(start, clock.now())

    const suffix = `kl ${hhmm}-${hhmm_end}, ${duration} min`
    if (inDays < 7) {
        return `${weekday}, ${suffix}`
    } else {
        return `${weekday}, ${date}\n${suffix}`
    }
}

export class Notifications {
    messaging: Messaging

    constructor(messaging: Messaging) {
        this.messaging = messaging
    }

    async send(clock: Clock, event: ICalEvent, creator: string | undefined, cal: Calendars[number]) {
        const topicName = `calendar-${cal.id}`
        const message: Message = {
            notification: {
                title: getNotificationTitle(cal.name, creator),
                body: getNotificationBody(clock, event.start() as Date, event.end() as Date)
            },
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
        logger.info('Sending notification for new event!', {
            cal,
            notification: message.notification,
            event: pick(event.toJSON(), 'id', 'start', 'summary', 'description')
        })

        const id = await this.messaging.send(message)
        logger.info('Sent notification ' + id, { cal })

        return message.notification
    }

}
