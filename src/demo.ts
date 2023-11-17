/*
*   npx ts-node -T src/demo.ts
*/

import { formatInTimeZone } from 'date-fns-tz';
import { launch } from 'puppeteer';
import { calendar, fetchCookies } from './lib/calendars'
import { bookActivityRaw } from './lib/booking';
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore';
import { addDays, addMinutes, formatDistanceStrict, formatISO, formatISO9075, parseISO, startOfDay } from 'date-fns';

config();

initializeApp({ projectId: 'nackswinget-af7ef' });

const time = '23:45';
const date = '2023-11-18T23:00:00.000Z';

const start = startOfDay(parseISO(date))
const end = startOfDay(addDays(start, 1))

console.log({ start, end })
console.log({
    start: formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss', ),
    end: formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss')
})
;
(async () => {

    const browser = await launch({ headless: false });
    const db = getFirestore()

    await calendar(browser, undefined, db, true, [
        { name: 'Friträning', id: '337667' }
    ])
    await browser.close()

    process.exit(0)
});

(async () => {

    const start = new Date("2023-11-09 14:00:00")
    const end = addMinutes(start, 60)

    const db = getFirestore()
    const cookies = await fetchCookies(db)
    const result = await bookActivityRaw('337667', {
        name: 'Friträning',
        description: 'Filip 0702683230',
        start,
        end,
        venueName: 'Ceylon'
    }, cookies)

    console.debug(JSON.stringify(result, null, 2))
    process.exit(0)
});


(async () => {

    const db = getFirestore()

    const list = await db.collection('calendars')
        .where('updated_at', '>=', new Date(0))
        .get()

    list.forEach(d => {
        const data = d.data()

        const updatedAt = data.updated_at.toDate();
        const calendarLastDate = parseISO(data.calendar_last_date)

        return console.log({
            ...data,
            updated_at: formatDistanceStrict(updatedAt, new Date(), { unit: 'hour' }),
            calendar_last_date: formatDistanceStrict(calendarLastDate, new Date(), { unit: 'hour' })
        });
    })

});