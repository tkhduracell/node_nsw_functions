import { ICalCalendar } from 'ical-generator'
import { type ListedActivities } from './types'
import { parseISO } from 'date-fns'

import { logger } from '../logging'

export function buildCalendar(url: string, activities: ListedActivities, subject: { name: string, id: string }): ICalCalendar {
    const calendar = new ICalCalendar()
    calendar.name(subject.name)
    calendar.prodId({
        company: 'DK Nackswinget',
        product: subject.name,
        language: 'SV'
    })
    calendar.url('https://nackswinget.se/Kalender')
    calendar.timezone('Europe/Stockholm')
    calendar.source(url)

    logger.info('Generating calendar from ' + activities.length + ' events', { cal: subject })
    for (const { listedActivity } of activities) {
        const { shared, calendarId, activityId, startTime, endTime, name, venueName, description } = listedActivity

        if (shared && `${calendarId}` !== `${subject.id}`) {
            // Ignore shared events
            continue;
        }

        const event = calendar.createEvent({
            start: parseISO(startTime),
            end: parseISO(endTime),
            summary: name,
            description,
            location: venueName ?? '',
            id: activityId
        })

        // If adhere to the format "organizer - phone number" on the first line then add the organizer
        if (description) {
            const [firstline] = description.split('\n')
            if (firstline.match(/.* - \+?[0-9 ]+/i)) {
                const [organiser,] = firstline.split(' - ')
                event.organizer({ name: organiser })
            }
        }
    }
    logger.info('Generated a calendar of ' + calendar.length() + ' events (post filtering)', { cal: subject })
    
    return calendar
}
