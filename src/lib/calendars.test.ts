import { updateCalendarContent } from './calendars';
import { Firestore } from 'firebase-admin/firestore';
import { Bucket } from '@google-cloud/storage';
import { ListedActivities, ListedActivity } from './types';

import { fetch }  from "cross-fetch"
jest.mock('cross-fetch');

import { fetchActivities } from './booking'
jest.mock('./booking');

import { Messaging, getMessaging } from 'firebase-admin/messaging';
jest.mock('firebase-admin/messaging');

beforeAll(() => {
  process.env.ACTIVITY_ORG_ID = '1234'
  process.env.ACTIVITY_BASE_URL = 'http://mock.app'
  process.env.ACTIVITY_USERNAME = 'user'
  process.env.ACTIVITY_PASSWORD = 'pass'
})

const DateClass = Date

describe('updateCalendarContent', () => {
    let mockFirestoreData = { calendar_last_uid: undefined as number | undefined }
    let mockFirestore: jest.Mocked<Firestore>;
    let mockBucket: jest.Mocked<Bucket>;

    beforeEach(() => {
        jest.mocked(fetch).mockReset()
        jest.mocked(fetchActivities).mockReset()
        jest.mocked(getMessaging).mockReset()
        jest.spyOn(global, 'Date').mockRestore()

        mockFirestore = {
            collection: jest.fn().mockReturnThis(),
            doc: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ data: jest.fn().mockResolvedValue(mockFirestoreData) }),
            set: jest.fn().mockResolvedValue({}),
        } as unknown as jest.Mocked<Firestore>;

        mockBucket = {
            file: jest.fn().mockReturnThis(),
            save: jest.fn().mockResolvedValue({}),
            getFiles: jest.fn().mockResolvedValue([[]]),
        } as unknown as jest.Mocked<Bucket>;
    });

    it('should update calendar content successfully', async () => {
        // Mock necessary dependencies
        const mockCalendars = [
            { id: 'calendar1', name: 'Calendar 1', orgId: '1' },
            { id: 'calendar2', name: 'Calendar 2', orgId: '1' },
        ];

        jest.mocked(fetchActivities).mockImplementation(() => Promise.resolve({
            data: [], response: jest.fn() as unknown as Response
        }))

        jest.spyOn(global, 'Date')
            .mockImplementationOnce(() => new DateClass('2023-09-20T15:14:59.344Z'))
            .mockImplementationOnce((arg) => new DateClass(arg))
            .mockImplementationOnce((arg) => new DateClass(arg))

        // Call the function
        await updateCalendarContent(mockCalendars, [], mockBucket, mockFirestore);

        // Assert the expected result
        expect(fetchActivities).toHaveBeenCalledWith(
            new DateClass('2023-06-22T15:14:59.344Z'),
            new DateClass('2024-09-20T15:14:59.344Z'),
            "calendar1", []);
    });

    it('should notify new event', async () => {
        // Mock necessary dependencies
        const mockCalendars = [
            { id: 'calendar1', name: 'Calendar 1', orgId: '1' },
        ];

        const startTime = new DateClass().getTime() + 1000 * 60 * 60 * 24 * 3
        const endTime = startTime + 1000 * 60 * 60
        const listedActivity = jest.mocked({
            shared: false,
            activityId: 1,
            startTime: new DateClass(startTime).toISOString(),
            endTime: new DateClass(endTime).toISOString(),
            name: 'Mock Event',
            venueName: 'Mock Venue',
            description: 'Mock Description'
        } as Partial<ListedActivity> as unknown as ListedActivity);

        const data: ListedActivities = [
            { listedActivity }
        ];
        jest.mocked(fetchActivities).mockImplementation(() => Promise.resolve({
            data, response: jest.fn() as unknown as Response
        }));
        mockFirestoreData['calendar_last_uid'] = 0

        const send = jest.fn().mockResolvedValue({})
        jest.mocked(getMessaging).mockImplementation(() => ({ send } as unknown as Messaging));

        // Call the function
        await updateCalendarContent(mockCalendars, [], mockBucket, mockFirestore);

        expect(send).toHaveBeenCalledWith({
            notification: {
                body: expect.stringContaining("60 min"),
                title: "Calendar 1 uppdaterad",
            },
            topic: "calendar-calendar1",
            webpush: {
                notification: {
                    icon: "https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg",
                    tag: "nsw-calendar-calendar1",
                },
            },
        });
    });
});
