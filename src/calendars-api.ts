import { ClockFactory } from './lib/clock';
import { logger, loggerMiddleware } from './logging'
import { Storage } from '@google-cloud/storage'
import { CloudSchedulerClient } from '@google-cloud/scheduler'
import z from 'zod'
import { join } from 'path'
import { updateLean, status } from './lib/calendars'
import { GCloudOptions, IDOActivityOptions } from './env'
import { ActivityApi, CookieProvider } from './lib/booking'
import { getFirestore } from 'firebase-admin/firestore'
import { fetchCookies } from './lib/cookies'
import { differenceInMinutes } from 'date-fns'
import { initializeApp } from 'firebase-admin/app'
import express from 'express'
import { errorHandling, prettyJson } from './middleware'
import { cors } from './lib/cors'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)
app.use(errorHandling)

if (require.main === module) {
    console.clear()
    console.info('Starting calendars-api')
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => console.info(`Listening on port ${port}`))
}

async function cookies(): Promise<CookieProvider> {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()

    const cookies = await fetchCookies(db, orgId)
    return { get: () => cookies }
}

app.get('/', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT })
    const bucket = storage.bucket(GCLOUD_BUCKET)

    if (!req.query.id) {
        const [file] = await bucket.file('index.json').download()

        return res.header('Content-Type', 'application/json').send(file).end()
    }

    const {id, dl} = z.object({
        id: z.string().regex(/\d+/),
        dl: z.string().transform(v => v === 'true').default("true")
    }).parse(req.query)

    const [exists] = await bucket.file(`cal_${id}.ics`).exists()
    if (!exists) {
        return res.status(404).send({ message: 'Calendar not found' }).end()
    }

    const [{ metadata }] = await bucket.file(`cal_${id}.ics`).getMetadata()
    const name = metadata && 'CalendarName' in metadata ? metadata.CalendarName : id

    if (dl) {
        res
            .setHeader('Content-Type', 'text/calendar')
            .setHeader('Content-Disposition', `attachment; filename="${name}.ics"`)
            .status(200)
    } else {
        res
            .setHeader('Content-Type', 'text/plain; charset=utf-8')
            .status(200)
    }

    return bucket
        .file(`cal_${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
})

app.post('/update', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT })
    const bucket = storage.bucket(GCLOUD_BUCKET)
    const db = getFirestore()

    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)

    try {
        await updateLean(bucket, db, ClockFactory.native(), orgId)
    } catch (err: any) {
        logger.error('Error in updateLean()', err)

        return res.status(500)
            .send({ message: `Unable to perform update: ${err?.message}` })
            .end()
    }

    res.status(200).end()
})

app.get('/update', async (req, res) => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()

    try {
        logger.info('Getting calendar status', { orgId })
        const result = await status(db, orgId, ClockFactory.native())
        return res.status(200)
            .json(result)
    } catch (err: any) {
        logger.error('Error in status()', err)

        return res.status(500)
            .json({ message: `Unable to perform update: ${err?.message}` })
    }
})

app.options('/book/search', cors);
app.get('/book/search', cors, async (req, res) => {
    const QuerySchema = z.object({
        date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
        calendarId: z.enum(['337667']).default('337667')
    })

    const query = await QuerySchema.safeParseAsync(req.query)
    if (!query.success) {
        logger.error('Invalid request', query.error.flatten().fieldErrors)
        return res.status(400).send(JSON.stringify({
            sucesss: false,
            error: 'Invalid request: invalid ' + Object.keys(query.error.flatten().fieldErrors).join(',')
        }))
    }

    const { ACTIVITY_ORG_ID: orgId, ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)
    const actApi = new ActivityApi(orgId, baseUrl, await cookies(), fetch)

    const { date, calendarId } = query.data

    try {

        const { data } = await actApi.fetchActivitiesOnDate(date, calendarId)
        const activities = data.map(e => e.listedActivity)

        const out = activities.map(({ activityId, name, description, startTime, endTime, calendarId }) => {
            return {
                id: activityId,
                name,
                description,
                calendarId,
                startTime,
                endTime,
                duration: differenceInMinutes(new Date(endTime), new Date(startTime)),
            }
        })

        res.json(out)
    } catch (e: any) {
        if ('response' in e) {
            const { status, statusText, url } = e.response as Response
            logger.error('Unable to fetch activities, got HTTP ' + status, { response: { status, statusText, url } })
        } else {
            logger.error('Unable to fetch activities, unknown ', e)
        }
        res.status(500).json({
            sucesss: false,
            error: 'Unable to fetch activities'
        })
    }
})

app.get('/book', async (req, res) => {
    res.sendFile(join(__dirname, '..', 'static', 'booking.html'), {
        headers: {
            'Content-Type': 'text/html; charset=utf-8'
        }
    })
})

app.post('/book', async (req, res) => {
    const BookingSchema = z.object({
        title: z.string().min(3),
        description: z.string().min(3),
        location: z.string().default(''),
        date: z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/),
        time: z.string().regex(/[0-9][0-9]:[0-9][0-9].*/),
        duration: z.number().min(30).max(300),
        password: z.enum(['Ceylon2023']),
        calendarId: z.enum(['337667']).default('337667')
    })

    const { ACTIVITY_ORG_ID: orgId, ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)

    const data = await BookingSchema.safeParseAsync(req.body)
    if (data.success) {
        const { password, calendarId, ...event } = data.data

        const actApi = new ActivityApi(orgId, baseUrl, await cookies(), fetch)

        logger.info('Booking activity', event)
        try {
            const { activityId } = await actApi.bookActivity(calendarId, event)
            res.status(200).send({
                success: true,
                id: activityId
            })

            logger.info('Triggering update of activity in cloud schduler', event)
            triggerAsyncActivityUpdate()

        } catch (e: any) {
            if ('response' in e) {
                const { status, statusText, url } = e.response as Response
                logger.error('Unable to complete booking, got HTTP ' + status, { response: { status, statusText, url } })
            } else {
                logger.error('Unable to complete booking, unknown error', e)
            }
            res.status(500).json({
                sucesss: false,
                error: 'Unable to complete booking'
            })
        }
    } else {
        logger.error('Invalid request', data.error.flatten().fieldErrors)
        res.status(400).json({
            sucesss: false,
            error: 'Invalid request: invalid ' + Object.keys(data.error.flatten().fieldErrors).join(',')
        })
    }
})

function triggerAsyncActivityUpdate() {
    const { GCLOUD_PROJECT } = GCloudOptions.parse(process.env)
    const schduler = new CloudSchedulerClient({ projectId: GCLOUD_PROJECT })
    const jobName = 'calendar-update-lean-5m'
    schduler.runJob({ name: `projects/${GCLOUD_PROJECT}/locations/europe-west6/jobs/${jobName}` })
        .then(() => logger.info('Schduling of ' + jobName + ' complete!'))
        .catch((err: any) => logger.warn('Schduling of ' + jobName + ' failed!', err))
}

export default app
