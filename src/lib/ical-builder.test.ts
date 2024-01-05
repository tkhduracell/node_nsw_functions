import { Clock } from './clock'
import { Notifications } from './notifications'
import ical from 'ical-generator'
import { type Message, type Messaging } from 'firebase-admin/messaging'
import { buildCalendar } from './ical-builder'
import { ListedActivity } from './types'

const clock: Clock = { now: () => new Date('2023-09-20T15:14:59.344Z') }

describe('buildCalendar', () => {

    it('should build with empty', async () => {
        const cal = buildCalendar("https://mock.app/", [], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(0)
        expect(cal.name()).toBe('XX')
    })

    it('should build with event without description', async () => {
        const cal = buildCalendar("https://mock.app/", [
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
        const cal = buildCalendar("https://mock.app/", [
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
        const cal = buildCalendar("https://mock.app/", [
            {
                listedActivity: {
                    name: 'Activity',
                    description: 'Fooobar - 0701234567',
                    startTime: '2023-09-21T12:12:00.000+02:00',
                    endTime: '2023-09-21T14:13:00.000+02:00',
                } as Partial<ListedActivity> as unknown as ListedActivity
            }
        ], { id: '1', name: 'XX' })

        expect(cal.events()).toHaveLength(1)
        const [event] = cal.events()
        expect(event.organizer()).toEqual({ name: 'Fooobar' })
    })

    it('should build with event with int.pattern', async () => {
        const cal = buildCalendar("https://mock.app/", [
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
        const cal = buildCalendar("https://mock.app/", [
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
        const cal = buildCalendar("https://mock.app/", [
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
})

