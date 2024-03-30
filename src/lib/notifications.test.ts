import { Clock } from './clock'
import { Notifications } from './notifications'
import ical from 'ical-generator'
import { type Message, type Messaging } from 'firebase-admin/messaging'

const clock: Clock = { now: () => new Date('2023-09-20T15:14:59.344Z') }

describe('Notifications', () => {

    function notificatioMock() {
        const send = jest.fn().mockResolvedValue("id1")
        const m = jest.fn<Messaging, any, any>(() => ({ send }) as unknown as Messaging)
        const sut = new Notifications(m())
        function notification() {
            expect(send).toHaveBeenCalled()
            return (send.mock.calls[0][0] as Message).notification
        }
        return { sut, notification }
    }

    it.each([
        ['UTC', '2023-09-21T12:12:00.000Z', '2023-09-21T14:13:00.000Z', 'Torsdag, kl 14:12-16:13, 121 min'],
        ['+02:00', '2023-09-21T12:12:00.000+02:00', '2023-09-21T14:13:00.000+02:00', 'Torsdag, kl 12:12-14:13, 121 min'],
    ])(`should notify time %s properly`, async (_, start, end, body) => {

        const { sut, notification } = notificatioMock()
        
        const calendar = ical();
        const event = calendar.createEvent({ start: new Date(start), end: new Date(end) })

        sut.send(clock, event, "Someone", { id: '1', name: 'XX', orgId: '1' })

        const x = notification()
        expect(x).toHaveProperty('body', body)
        expect(x).toHaveProperty('title', 'Ny bokning i XX')
    })

    it.each([
        ['Friträning', 'Alice har bokat en friträning!'],
        ['Tematräning dubbelbugg', 'Alice har bokat en tematräning!'],
        ['Tematräning - dubbelbugg', 'Alice har bokat en tematräning!'],
        ['Tematräning: Lindy hop', 'Alice har bokat en tematräning!']
    ])('should notify %s as %s', async (summary, title) => {
        const { sut, notification } = notificatioMock()

        const calendar = ical();
        const event = calendar.createEvent({ 
            start: new Date('2023-09-21T12:12:00.000+02:00'), 
            end: new Date('2023-09-21T14:13:00.000+02:00'), 
            summary
        })

        sut.send(clock, event, "Alice", { id: '1', name: 'Friträning', orgId: '1' })

        const x = notification()
        expect(x).toHaveProperty('body', 'Torsdag, kl 12:12-14:13, 121 min')
        expect(x).toHaveProperty('title', title)
    })

    
})

