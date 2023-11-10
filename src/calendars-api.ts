import { Storage } from '@google-cloud/storage'
import z from 'zod'
import express from 'express'
import {join} from 'path'

import { GCloudOptions } from './env'
import { bookActivity } from './lib/booking'
import { getFirestore } from 'firebase-admin/firestore'

const app = express()
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


app.get('/book', async (req, res) => {
   res.sendFile(join(__dirname, '..', 'static', 'booking.html'), {  })
});

app.post('/book', async (req, res) => {
    const db = getFirestore()

    const BookingSchema = z.object({
        title: z.string().min(3),
        description: z.string().min(3),
        venueName: z.string().default(""),
        date: z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        time: z.string().regex(/[0-9][0-9]:[0-9][0-9].*/),
        duration: z.number().min(30).max(300),
        password: z.enum(['Ceylon2023']),
        calendarId: z.enum(['337667']).default('337667')
    })

    const data = await BookingSchema.safeParseAsync(req.body)
    if (data.success) {
        const { password, calendarId, ...event } = data.data

        console.log('Booking activity', event)
        const { activityId } = await bookActivity(db, calendarId, event)
        res.status(200).send({
            success: true,
            id: activityId
        })
    } else {
        console.error(data.error.flatten().fieldErrors)
        res.status(400).send(JSON.stringify({
            sucesss: false,
            error: data.error.name
        }))
    }
 });


export default app