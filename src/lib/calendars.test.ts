import { updateCalendarContent } from './calendars'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { type Bucket } from '@google-cloud/storage'
import { type ListedActivity } from './types'

import { logger } from '../logging'
jest.mock('../logging')

import { type Messaging, getMessaging } from 'firebase-admin/messaging'
import { ActivityApi } from './booking'
import { addDays, addMinutes } from 'date-fns'
import { Clock } from './clock'
jest.mock('firebase-admin/messaging')

beforeAll(() => {
    process.env.ACTIVITY_ORG_ID = '1234'
    process.env.ACTIVITY_BASE_URL = 'http://mock.app'
    process.env.ACTIVITY_USERNAME = 'user'
    process.env.ACTIVITY_PASSWORD = 'pass'
})

const clock: Clock = { now: () => new Date('2023-09-20T15:14:59.344Z') }

describe('updateCalendarContent', () => {
    let firestore: jest.Mocked<Firestore>
    let bucket: jest.Mocked<Bucket>

    let mocks = {
        firestore: {
            set: jest.fn().mockResolvedValue({}),
            data: { calendar_last_uid: undefined as number | undefined }
        },
        notifictions: {
            send: jest.fn().mockResolvedValue({})
        }
    }

    beforeEach(() => {
        jest.mocked(getMessaging).mockReset().mockImplementation(() => ({
            send: mocks.notifictions.send
        } as unknown as Messaging))

        jest.spyOn(global, 'Date').mockRestore()
        jest.mocked(logger)

        mocks.notifictions.send.mockReset()
        mocks.firestore.set.mockReset()

        firestore = {
            collection: jest.fn().mockReturnThis(),
            doc: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ data: jest.fn(() => Promise.resolve(mocks.firestore.data)) }),
            set: mocks.firestore.set
        } as unknown as jest.Mocked<Firestore>

        bucket = {
            file: jest.fn().mockReturnThis(),
            save: jest.fn().mockResolvedValue({}),
            getFiles: jest.fn().mockResolvedValue([[]]),
            cloudStorageURI: new URL('gcs://bucket')
        } as unknown as jest.Mocked<Bucket>
    })

    it('should update calendar content successfully', async () => {
        // Mock necessary dependencies
        const calendars = [
            { id: 'calendar1', name: 'Calendar 1', orgId: '1' },
            { id: 'calendar2', name: 'Calendar 2', orgId: '1' }
        ]

        const actApi = jest.mocked(new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch))
        actApi.fetchActivities = jest.fn().mockResolvedValue({ data: [], response: {} as unknown as Response })
        const spy = jest.spyOn(actApi, 'fetchActivities')

        // Call the function
        await updateCalendarContent(calendars, actApi, clock, bucket, firestore)

        // Assert the expected result
        expect(spy).toHaveBeenCalledWith(
            new Date('2023-06-22T15:14:59.344Z'),
            new Date('2024-09-20T15:14:59.344Z'),
            'calendar1')
        expect(spy).toHaveBeenCalledWith(
            new Date('2023-06-22T15:14:59.344Z'),
            new Date('2024-09-20T15:14:59.344Z'),
            'calendar2')
    })

    it('should notify new event if old event sent', async () => {
        const calendars = [{ id: 'calendar1', name: 'Calendar 1', orgId: '1' }]
        const listedActivity = createEvent(clock, 222, 3, 60)

        mocks.firestore.data.calendar_last_uid = 111

        const mock = jest.mocked(new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch))
        mock.fetchActivities = jest.fn().mockResolvedValue({ data: [{ listedActivity }], response: {} as unknown as Response })

        // Call the function
        await updateCalendarContent(calendars, mock, clock, bucket, firestore)

        expect(mocks.firestore.set).toHaveBeenCalledWith({
            "calendar_id": "calendar1",
            "calendar_last_date": new Date("2023-09-23T15:14:59.344Z"),
            "calendar_last_uid": "222",
            "calendar_name": "Calendar 1",
            "calendar_org_id": "1",
            "last_notifications": [{
                "at": "2023-09-20T15:14:59.344Z",
                "body": "Lördag, kl 17:14-18:14, 60 min",
                "title": "Calendar 1 uppdaterad",
                "event": {
                    "description": "Description 222",
                    "id": "222",
                    "start": "2023-09-23T15:14:59.344Z",
                },
            }],
            "updated_at": FieldValue.serverTimestamp(),
        }, { merge: true });

        expect(mocks.notifictions.send).toHaveBeenCalled()
    })

    it('should notify latest event if multiple new', async () => {
        const calendars = [{ id: 'calendar1', name: 'Calendar 1', orgId: '1' }]
        const e1 = createEvent(clock, 333, 3, 60)
        const e2 = createEvent(clock, 111, 3, 60)
        const e3 = createEvent(clock, 444, 3, 60)
        const e4 = createEvent(clock, 222, 3, 60)
        const data = [e1, e2, e3, e4].map(e => ({ listedActivity: e }))

        mocks.firestore.data.calendar_last_uid = 111

        const mock = jest.mocked(new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch))
        mock.fetchActivities = jest.fn().mockResolvedValue({ data, response: {} as unknown as Response })

        // Call the function
        await updateCalendarContent(calendars, mock, clock, bucket, firestore)

        expect(mocks.firestore.set).toHaveBeenCalledWith({
            "calendar_id": "calendar1",
            "calendar_last_date": new Date("2023-09-23T15:14:59.344Z"),
            "calendar_last_uid": "222",
            "calendar_name": "Calendar 1",
            "calendar_org_id": "1",
            "last_notifications": [{
                "at": "2023-09-20T15:14:59.344Z",
                "body": "Lördag, kl 17:14-18:14, 60 min",
                "title": "Calendar 1 uppdaterad",
                "event": {
                    "id": "222",
                    "description": "Description 222",
                    "start": "2023-09-23T15:14:59.344Z",
                }
            }],
            "updated_at": FieldValue.serverTimestamp(),
        }, { merge: true });
    })

    it('should notify new event if not set', async () => {
        const calendars = [{ id: 'calendar1', name: 'Calendar 1', orgId: '1' }]
        const e1 = createEvent(clock, 333, 3, 60)
        const e2 = createEvent(clock, 111, 3, 60)
        const e3 = createEvent(clock, 444, 3, 60)
        const e4 = createEvent(clock, 222, 3, 60)
        const data = [e1, e2, e3, e4].map(e => ({ listedActivity: e }))

        mocks.firestore.data.calendar_last_uid = undefined

        const mock = jest.mocked(new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch))
        mock.fetchActivities = jest.fn().mockResolvedValue({ data, response: {} as unknown as Response })

        // Call the function
        await updateCalendarContent(calendars, mock, clock, bucket, firestore)

        expect(mocks.notifictions.send).toHaveBeenCalled()
    })
})

function createEvent(clock: Clock, id: number, inDays: number, durationMinutes: number) {
    const startTime = addDays(clock.now(), inDays)
    const endTime = addMinutes(startTime, durationMinutes)
    return {
        shared: false,
        activityId: id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        name: 'Event ' + id,
        venueName: 'Venue ' + id,
        description: 'Description ' + id
    } satisfies Partial<ListedActivity> as unknown as ListedActivity
}

