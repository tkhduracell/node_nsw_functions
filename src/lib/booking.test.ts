import { ActivityApi } from './booking'
import { HttpFetch } from './types'


test('should fetch activities', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => await Promise.resolve({
        listedActivity: []
    }) } as Response)

    const api = new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch as HttpFetch)

    await api.fetchActivitiesOnDate('2023-11-18T23:00:00.000Z', '1')

    const [call] = fetch.mock.calls
    const [url, opts] = call
    expect(url).toBe('http://mock.app/activities/getactivities?calendarId=1&startTime=2023-11-19+00%3A00%3A00&endTime=2023-11-20+00%3A00%3A00')
    expect(opts).toHaveProperty('method', 'GET')
})

test('should throw if invalid format on activities', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => await Promise.resolve({
        listedActivity: 123
    }) } as Response)

    const api = new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch as HttpFetch)

    expect(api.fetchActivitiesOnDate('2023-11-18T23:00:00.000Z', '1')).rejects.toThrow('No json response from API:')
})

test('should book activities', async () => {
    const resp = { success: true, activities: [{ foo: 'bar' }] }

    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => await Promise.resolve(resp) } as Response)

    const api = new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch)

    const out = await api.bookActivity('4567', {
        duration: 60,
        time: '21:00',
        date: '2023-11-21T23:00:00.000Z',
        location: 'Ceylon',
        description: 'Filip - 0702683230',
        title: 'Friträning'
    })

    const [call] = fetch.mock.calls
    const [url, opts] = call
    expect(url).toBe('http://mock.app/Activities/SaveActivity')
    expect(opts).toHaveProperty('method', 'POST')
    expect(opts).toHaveProperty('body')

    const body = JSON.parse(opts?.body as string)
    expect(body).toHaveProperty('activity')

    const { activity } = body
    expect(activity).toStrictEqual(
        {
            organisationId: 1234,
            calendarId: '4567',
            sportId: '63',
            shared: false,
            venue: { venueName: 'Ceylon' },
            activityTypeId: '1',
            startDateTimeString: '2023-11-22 21:00:00',
            endDateTimeString: '2023-11-22 22:00:00',
            allDayActivity: false,
            name: 'Friträning',
            description: 'Filip - 0702683230',
            spansMultipleDays: false
        }
    )
    expect(out).toStrictEqual({ foo: 'bar' })
})

test('should book activities with right datetime', async () => {
    const resp = { success: true, activities: [{ foo: 'bar' }] }

    const fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => await Promise.resolve(resp) } as Response)

    const api = new ActivityApi('1234', 'http://mock.app', { get: () => [] }, fetch)

    await api.bookActivity('1', { title: 'Friträning', location: 'Ceylon', date: '2023-11-17T23:00:00.000Z', time: '13:37', duration: 60, description: 'Filip - 0702683230' })

    const [call] = fetch.mock.calls
    const [url, opts] = call
    expect(url).toBe('http://mock.app/Activities/SaveActivity')

    const body = JSON.parse(opts?.body as string)
    expect(body).toHaveProperty('activity')

    const { activity } = body
    expect(activity).toHaveProperty('startDateTimeString', '2023-11-18 13:37:00')
    expect(activity).toHaveProperty('endDateTimeString', '2023-11-18 14:37:00')
})
