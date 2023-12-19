/*
*   npm run demo
*/

import { formatInTimeZone } from 'date-fns-tz';
import { login } from './lib/calendars'
import { bookActivityRaw } from './lib/booking';
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore';
import { addDays, addMinutes, formatDistanceStrict, parseISO, startOfDay } from 'date-fns';
import { fetchCookies } from './lib/cookies';
import { launchBrowser } from './calendars-update-api';
import { orderBy } from 'lodash';
import { IDOActivityOptions } from './env';

config();

initializeApp({ projectId: 'nackswinget-af7ef' });


(async () => {
    const date = '2023-11-18T23:00:00.000Z';

    const start = startOfDay(parseISO(date))
    const end = startOfDay(addDays(start, 1))

    console.log({ start, end })
    console.log({
        start: formatInTimeZone(start, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss', ),
        end: formatInTimeZone(end, 'Europe/Stockholm', 'yyyy-MM-dd HH:mm:ss')
    })
});

(async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()
    const cookies = await fetchCookies(db, orgId)

    for (const cookie of orderBy(cookies, c => c.expires)) {
        if ((cookie as any).session) continue
        console.log(new Date((cookie.expires ?? 0) * 1000), cookie.name, cookie.value)
    }

})();

(async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const browser = await launchBrowser();
    const db = getFirestore()
    try {
        await login(browser, db, orgId)
    } catch (err) {
        console.error(err)
    } finally {
        await browser.close()
    }

    process.exit(0)
});

(async () => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const start = new Date("2023-11-09 14:00:00")
    const end = addMinutes(start, 60)

    const db = getFirestore()
    const cookies = await fetchCookies(db, orgId)
    const result = await bookActivityRaw(orgId, '337667', {
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