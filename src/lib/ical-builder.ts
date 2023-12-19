import { ICalCalendar } from "ical-generator"
import { ListedActivities } from "./types"
import { parseISO } from "date-fns"

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

    for (const { listedActivity } of activities) {
        const { shared, activityId, startTime, endTime, name, venueName, description } = listedActivity

        // Ignore shared events
        if (shared) continue

        calendar.createEvent({
            start: parseISO(startTime),
            end: parseISO(endTime),
            summary: name,
            description: description,
            location: venueName ?? '',
            id: activityId
        });
    }

    return calendar
}