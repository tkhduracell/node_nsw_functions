import { Clock } from './clock'
import { Notifications } from './notifications'
import ical from 'ical-generator'
import { type Message, type Messaging } from 'firebase-admin/messaging'

const clock: Clock = { now: () => new Date('2023-09-20T15:14:59.344Z') }

describe('Notifications', () => {

    it('should notify with STO time', async () => {
        const send = jest.fn().mockResolvedValue("id1")
        const m = jest.fn<Messaging, any, any>(() => ({ send }) as unknown as Messaging)
        const sut = new Notifications(m())

        const calendar = ical();
        const event = calendar.createEvent({ start: new Date('2023-09-21T12:12:00.000Z'), end: new Date('2023-09-21T14:13:00.000Z') })

        sut.send(clock, event, "Someone", { id: '1', name: 'XX', orgId: '1' })

        expect(send).toHaveBeenCalled()
        const { notification: x } = send.mock.calls[0][0] as Message
        expect(x?.body).toEqual('Torsdag, kl 14:12-16:13, 121 min')
        expect(x?.title).toEqual('Ny bokning i XX')
    })

    it('should notify STO time as STO time', async () => {
        const send = jest.fn().mockResolvedValue("id1")
        const m = jest.fn<Messaging, any, any>(() => ({ send }) as unknown as Messaging)
        const sut = new Notifications(m())

        const calendar = ical();
        const event = calendar.createEvent({ start: new Date('2023-09-21T12:12:00.000+02:00'), end: new Date('2023-09-21T14:13:00.000+02:00') })

        sut.send(clock, event, "Someone", { id: '1', name: 'XX', orgId: '1' })

        expect(send).toHaveBeenCalled()
        const { notification: x } = send.mock.calls[0][0] as Message
        expect(x?.body).toEqual('Torsdag, kl 12:12-14:13, 121 min')
        expect(x?.title).toEqual('Ny bokning i XX')
    })

    it('should notify with author if friträning', async () => {
        const send = jest.fn().mockResolvedValue("id1")
        const m = jest.fn<Messaging, any, any>(() => ({ send }) as unknown as Messaging)
        const sut = new Notifications(m())

        const calendar = ical();
        const event = calendar.createEvent({ start: new Date('2023-09-21T12:12:00.000+02:00'), end: new Date('2023-09-21T14:13:00.000+02:00') })

        sut.send(clock, event, "Alice", { id: '1', name: 'Friträning', orgId: '1' })

        expect(send).toHaveBeenCalled()
        const { notification: x } = send.mock.calls[0][0] as Message
        expect(x?.body).toEqual('Torsdag, kl 12:12-14:13, 121 min')
        expect(x?.title).toEqual('Alice har bokat en friträning!')
    })
})

