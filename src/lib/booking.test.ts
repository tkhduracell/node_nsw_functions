import { fetch }  from "cross-fetch"
import { bookActivity, fetchActivitiesOnDate } from "./booking"

jest.mock('cross-fetch');
beforeEach(() => {
  jest.mocked(fetch).mockReset()
})
beforeAll(() => {
  process.env.ACTIVITY_ORG_ID = '1234'
  process.env.ACTIVITY_BASE_URL = 'http://mock.app'
  process.env.ACTIVITY_USERNAME = 'user'
  process.env.ACTIVITY_PASSWORD = 'pass'
})

test('should fetch activities', () => {
  jest.mocked(fetch).mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response))

  fetchActivitiesOnDate('2023-11-18T23:00:00.000Z', '1', [])

  const [call] = jest.mocked(fetch).mock.calls
  const [url, opts] = call
  expect(url).toBe("http://mock.app/activities/getactivities?calendarId=1&startTime=2023-11-19+00%3A00%3A00&endTime=2023-11-20+00%3A00%3A00")
  expect(opts).toHaveProperty('method', 'GET')
});

test('should book activities', async () => {
  const resp =  { success: true, activities: [{ foo: 'bar' }] }

  jest.mocked(fetch).mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(resp) } as Response))

  const out = await bookActivity('1', {
    duration: 60,
    time: '21:00',
    date: '2023-11-21T23:00:00.000Z',
    location: 'Ceylon',
    description: 'Filip - 0702683230',
    title: 'Friträning',
  }, [])

  const [call] = jest.mocked(fetch).mock.calls
  const [url, opts] = call
  expect(url).toBe("http://mock.app/Activities/SaveActivity")
  expect(opts).toHaveProperty('method', 'POST')
  expect(opts).toHaveProperty('body')

  const body = JSON.parse(opts!.body as string)
  expect(body).toHaveProperty('activity')

  const { activity } = body
  expect(activity).toStrictEqual(
    {
      calendarId: '1',
      organisationId: 1234,
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
});

test('should book activities with right datetime', async () => {
  const resp =  { success: true, activities: [{ foo: 'bar' }] }

  jest.mocked(fetch).mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(resp) } as Response))

  const out = await bookActivity('1', {"title":"Friträning","location":"Ceylon","date":"2023-11-17T23:00:00.000Z","time":"13:37","duration":60,"description":"Filip - 0702683230"}, [])

  const [call] = jest.mocked(fetch).mock.calls
  const [url, opts] = call
  expect(url).toBe("http://mock.app/Activities/SaveActivity")
  const body = JSON.parse(opts!.body as string)
  expect(body).toHaveProperty('activity')

  const { activity } = body
  expect(activity).toHaveProperty('startDateTimeString', '2023-11-18 13:37:00')
  expect(activity).toHaveProperty('endDateTimeString', '2023-11-18 14:37:00')
});
