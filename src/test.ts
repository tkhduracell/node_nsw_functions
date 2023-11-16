/*
*   npx ts-node -T src/test.ts
*/

import { launch } from 'puppeteer';
import { calendar } from './lib/calendars'
import { bookActivityRaw } from './lib/booking';
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore';
import { addMinutes, formatDistanceStrict, parseISO } from 'date-fns';

config();

initializeApp({ projectId: 'nackswinget-af7ef' });

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
    const result = await bookActivityRaw(db, '337667', {
        name: 'Friträning',
        description: 'Filip 0702683230',
        start,
        end,
        venueName: 'Ceylon'
    })

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