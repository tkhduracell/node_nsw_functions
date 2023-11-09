/*
*   npx ts-node -T src/test.ts
*/

import { launch } from 'puppeteer';
import { calendar } from './lib/calendars'
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore';
import { formatDistanceStrict, parseISO } from 'date-fns';

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
})();


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

})();