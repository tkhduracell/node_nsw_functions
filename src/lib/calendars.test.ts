import { updateCalendarContent } from './calendars'
import { type Firestore } from 'firebase-admin/firestore'
import { type Bucket } from '@google-cloud/storage'
import { CalendarNotification, type ListedActivities, type ListedActivity } from './types'

import { logger } from '../logging'
jest.mock('../logging')

import { fetch } from 'cross-fetch'
jest.mock('cross-fetch')

import { fetchActivities } from './booking'
jest.mock('./booking')

import { type Messaging, getMessaging } from 'firebase-admin/messaging'
jest.mock('firebase-admin/messaging')

beforeAll(() => {
    process.env.ACTIVITY_ORG_ID = '1234'
    process.env.ACTIVITY_BASE_URL = 'http://mock.app'
    process.env.ACTIVITY_USERNAME = 'user'
    process.env.ACTIVITY_PASSWORD = 'pass'
})

const DateClass = Date

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
        },
        activites: {
            data: [] as ListedActivities
        }
    }

    beforeEach(() => {
        jest.mocked(fetch).mockReset()
        jest.mocked(fetchActivities).mockReset().mockImplementation(() => Promise.resolve({
            data: mocks.activites.data, response: jest.fn()
        } as unknown as ReturnType<typeof fetchActivities>))
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

        mocks.activites.data = []

        jest.spyOn(global, 'Date')
            .mockImplementationOnce(() => new DateClass('2023-09-20T15:14:59.344Z'))
            .mockImplementationOnce((arg) => new DateClass(arg))
            .mockImplementationOnce((arg) => new DateClass(arg))

        // Call the function
        await updateCalendarContent(calendars, [], bucket, firestore)

        // Assert the expected result
        expect(fetchActivities).toHaveBeenCalledWith(
            new DateClass('2023-06-22T15:14:59.344Z'),
            new DateClass('2024-09-20T15:14:59.344Z'),
            'calendar1', [])
    })

    it('should notify new event if old event sent', async () => {
        const calendars = [ { id: 'calendar1', name: 'Calendar 1', orgId: '1' }]
        const listedActivity = createEvent(222, 3, 60)

        mocks.firestore.data.calendar_last_uid = 111
        mocks.activites.data = [ { listedActivity } ]

        // Call the function
        await updateCalendarContent(calendars, [], bucket, firestore)

        expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
            "calendar_id": "calendar1",
            "calendar_last_date": expect.anything(),
            "calendar_last_uid": "222",
            "calendar_name": "Calendar 1",
            "calendar_org_id": "1",
            "last_notifications": expect.arrayContaining([expect.objectContaining({
                "id": "222"
            })]),
            "updated_at": expect.anything(),
        }), { merge: true });

        expect(mocks.notifictions.send).toHaveBeenCalledWith({
            notification: {
                body: expect.stringContaining('60 min'),
                title: 'Calendar 1 uppdaterad'
            },
            topic: 'calendar-calendar1',
            webpush: {
                notification: {
                    icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg',
                    tag: 'nsw-calendar-calendar1'
                }
            }
        })
    })

    it('should notify new event if not set', async () => {
        const calendars = [ { id: 'calendar1', name: 'Calendar 1', orgId: '1' }]
        const listedActivity = createEvent(222, 3, 60)

        mocks.firestore.data.calendar_last_uid = undefined
        mocks.activites.data = [ { listedActivity }]

        // Call the function
        await updateCalendarContent(calendars, [], bucket, firestore)

        expect(mocks.notifictions.send).toHaveBeenCalled()
    })
})

function createEvent(id: number, inDays: number, durationMinutes: number) {
    const startTime = new DateClass().getTime() + 1000 * 60 * 60 * 24 * inDays
    const endTime = startTime + 1000 * 60 * durationMinutes
    return {
        shared: false,
        activityId: id,
        startTime: new DateClass(startTime).toISOString(),
        endTime: new DateClass(endTime).toISOString(),
        name: 'Mock Event',
        venueName: 'Mock Venue',
        description: 'Mock Description'
    } satisfies Partial<ListedActivity> as unknown as ListedActivity
}

