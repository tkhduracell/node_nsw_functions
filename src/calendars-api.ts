import { Storage } from '@google-cloud/storage'
import z from 'zod'
import express from 'express'
import {join} from 'path'
import { updateLean, status } from './lib/calendars'
import { GCloudOptions, IDOActivityOptions } from './env'
import { bookActivity, fetchActivitiesOnDate } from './lib/booking'
import { getFirestore } from 'firebase-admin/firestore'
import { fetchCookies } from './lib/cookies'
import { differenceInMinutes } from 'date-fns'
import { initializeApp } from 'firebase-admin/app'

const app = express()

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => console.log(`Listening on port ${port}`))
}

app.use(express.json())
app.get('/', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    if (!req.query.id) {
        const [file] = await bucket.file('index.json').download()

        return res.header('Content-Type', 'application/json').send(file).end()
    }

    const id = z.string().regex(/\d+/).parse(req.query.id)

    const [{ metadata }] = await bucket.file(`cal_${id}.ics`).getMetadata()
    const name = metadata && 'CalendarName' in metadata ? metadata['CalendarName'] : id

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="${name}.ics"`)
        .status(200)

    bucket
        .file(`cal_${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
});

app.post('/update', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)
    const db = getFirestore()

    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    try {
        await updateLean(bucket, db, orgId)
    } catch (err: any) {
        console.error('Error in updateLean()', err)

        return res.status(500)
            .send({ message: "Unable to perform update:" + err?.message })
            .end()

    }

    res.status(200).end()
});

app.get('/update', async (req, res) => {
    const {
        ACTIVITY_ORG_ID
    } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()

    try {
        const result = await status(db, ACTIVITY_ORG_ID)
        return res.status(200)
            .json(result)

    } catch (err: any) {
        console.error('Error in ()', err)

        return res.status(500)
            .json({ message: "Unable to perform update:" + err?.message })

    }
});

app.get('/book/search', async (req, res) => {
    const QuerySchema = z.object({
        date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
        calendarId: z.enum(['337667']).default('337667')
    })

    const query = await QuerySchema.safeParseAsync(req.query)
    if (!query.success) {
        console.error('Invalid request', query.error.flatten().fieldErrors)
        return res.status(400).send(JSON.stringify({
            sucesss: false,
            error: 'Invalid request: invalid ' + Object.keys(query.error.flatten().fieldErrors).join(',')
        }))
    }

    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const db = getFirestore()
    const cookies = await fetchCookies(db, orgId)

    const { date, calendarId } = query.data

    const { data } = await fetchActivitiesOnDate(date, calendarId, cookies)
    const activities = data.map(e => e.listedActivity)

    const out = activities.map(({ name, startTime, endTime }) => {
        return {
            name,
            startTime,
            endTime,
            duration: differenceInMinutes(new Date(endTime), new Date(startTime))
        }
    })

    res.json(out)
})

app.get('/book', async (req, res) => {
   res.sendFile(join(__dirname, '..', 'static', 'booking.html'), {  })
});

app.post('/book', async (req, res) => {
    const db = getFirestore()

    const BookingSchema = z.object({
        title: z.string().min(3),
        description: z.string().min(3),
        location: z.string().default(""),
        date: z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        time: z.string().regex(/[0-9][0-9]:[0-9][0-9].*/),
        duration: z.number().min(30).max(300),
        password: z.enum(['Ceylon2023']),
        calendarId: z.enum(['337667']).default('337667')
    })

    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    const data = await BookingSchema.safeParseAsync(req.body)
    if (data.success) {
        const { password, calendarId, ...event } = data.data

        const cookies = await fetchCookies(db, orgId)

        console.log('Booking activity', event)
        const { activityId } = await bookActivity(orgId, calendarId, event, cookies)
        res.status(200).send({
            success: true,
            id: activityId
        })
    } else {
        console.error('Invalid request', data.error.flatten().fieldErrors)
        res.status(400).json({
            sucesss: false,
            error: 'Invalid request: invalid ' + Object.keys(data.error.flatten().fieldErrors).join(',')
        })
    }
});

export default app