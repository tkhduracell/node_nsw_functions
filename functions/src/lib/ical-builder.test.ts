import { buildCalendar } from './ical-builder'
import { ListedActivity } from './types'
import { format } from 'date-fns-tz'
import { parseISO } from 'date-fns'

describe('buildCalendar', () => {
    it('should build with empty', async () => {
        const cal = buildCalendar('https://mock.app/', [], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(0)
        expect(cal.name()).toBe('XX')
    })

    it('should build with event without description', async () => {
        const cal = buildCalendar('https://mock.app/', [
            {
                listedActivity: {
                    name: 'Activity',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
    })

    it('should build with event with description', async () => {
        const cal = buildCalendar('https://mock.app/', [
            {
                listedActivity: {
                    name: 'Activity',
                    description: 'foo',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
    })

    it('should build with event with pattern', async () => {
        const cal = buildCalendar('https://mock.app/', [{ listedActivity }], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.organizer()).toEqual({ name: 'Elisabet' })
    })

    it('should build with event with int.pattern', async () => {
        const cal = buildCalendar('https://mock.app/', [
            {
                listedActivity: {
                    name: 'Activity',
                    description: 'Fooobar - +46701234567',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.organizer()).toEqual({ name: 'Fooobar' })
    })

    it('should build with event with multiline pattern', async () => {
        const cal = buildCalendar('https://mock.app/', [
            {
                listedActivity: {
                    name: 'Activity',
                    description: 'Fooobar - 0701234567\nAsdasd',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.description()?.plain).toBe('Fooobar - 0701234567\nAsdasd')
        expect(event.organizer()?.name).toBe('Fooobar')
    })

    it('should build with event but ignore organise if not first line', async () => {
        const cal = buildCalendar('https://mock.app/', [
            {
                listedActivity: {
                    name: 'Activity',
                    description: 'Asdasd\nFooobar - 0701234567\nBarrrr',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.organizer()).toBeNull()
        expect(event.description()?.plain).toBe('Asdasd\nFooobar - 0701234567\nBarrrr')
    })

    it('should build with event times in stockholm time', async () => {
        const cal = buildCalendar('https://mock.app/', [{ listedActivity }], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.timezone()).toBe('Europe/Stockholm')
        expect(event.toString()).toContain('DTSTART:' + format(parseISO(listedActivity.startTime), 'yyyyMMdd\'T\'HHmmss', { timeZone: 'Europe/Stockholm' }))
        expect(event.toString()).toContain('DTEND:' + format(parseISO(listedActivity.endTime), 'yyyyMMdd\'T\'HHmmss', { timeZone: 'Europe/Stockholm' }))

        // expect(event.toString()).toContain("DTSTART:20240123T190000")
        // expect(event.toString()).toContain("DTEND:20240123T203000")
    })

    it('should build without shared events', async () => {
        const cal = buildCalendar('https://mock.app/', [{
            listedActivity: { ...listedActivity, shared: true }
        }], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(0)
    })

    it('should build with shared events from same calendar', async () => {
        const cal = buildCalendar('https://mock.app/', [{
            listedActivity: { ...listedActivity, shared: true }
        }], { id: listedActivity.calendarId + '', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
    })
})

const listedActivity = {
    activityId: 83570342,
    calendarId: 337667,
    name: 'Friträning och städning',
    startTime: '2024-01-23T19:00:00+01:00',
    endTime: '2024-01-23T20:30:00+01:00',
    allDayActivity: false,
    venueName: 'Ceylon',
    activityTypeId: 1,
    activityTypeName: 'Träning',
    activityTypeColor: '#27ae60',
    isRecurring: false,
    recurrenceId: null,
    meetingTime: null,
    meetingPlace: null,
    description: 'Elisabet - 0730000000',
    shared: false,
    hasSummons: false,
    attendanceIsRegistered: false,
    attendanceIsLok: false,
    attendanceWillBeRegistered: false,
    activityIsInApplication: false,
    externalDataSourceId: null,
    externalDataSourceActivityId: null,
    localCopySource: 0,
    notFromThisCalendar: false,
    modifiedProperties: {
        startTime: false,
        endTime: false,
        venueName: false
    },
    contactInformation: {
        personName: null,
        website: null,
        phone: null,
        email: null,
        hasValue: false
    },
    groupIds: null,
    recurrence: {
        recurrenceId: null,
        start: '0001-01-01T00:00:00',
        end: null,
        count: null,
        actualCount: null,
        timeUnit: 0,
        interval: 0,
        weekdays: [],
        day: null,
        month: null,
        week: null,
        description: 'Den här aktiviteten upprepas var 0:e dag från 0001-01-01 till , totalt  tillfällen'
    },
    organisationName: 'DK Nackswinget',
    sportsName: '(Danssport)',
    summonId: 0,
    indexInRecurrence: null
}
