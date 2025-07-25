import z from 'zod'
import express from 'express'

import { join } from 'path'
import { ClockFactory } from './lib/clock'
import { logger, loggerMiddleware } from './logging'
import { Storage } from '@google-cloud/storage'
import { CloudSchedulerClient } from '@google-cloud/scheduler'
import { updateLean, status, createApiFormat } from './lib/calendars'
import { GCloudOptions, IDOActivityOptions } from './env'
import { ActivityApi, CookieProvider } from './lib/booking'
import { getFirestore } from 'firebase-admin/firestore'
import { fetchCookies } from './lib/cookies'
import { initializeApp } from 'firebase-admin/app'
import { errorHandling, prettyJson } from './middleware'
import { cors } from './lib/cors'

const app = express()
app.use(express.json())
app.use(prettyJson)
app.use(loggerMiddleware)
app.use(errorHandling)

if (require.main === module) {
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

        return res
            .header('Content-Type', 'application/json')
            .send(file)
            .end()
    }

    const { id, dl } = z.object({
        id: z.string().regex(/\d+/),
        dl: z.string().transform(v => v === 'true').default('true')
    }).parse(req.query)

    const [exists] = await bucket.file(`cal_${id}.ics`).exists()
    if (!exists) {
        return res
            .status(404)
            .json({ message: 'Calendar not found' })
            .end()
    }

    const [{ metadata }] = await bucket.file(`cal_${id}.ics`).getMetadata()
    const name = metadata && 'CalendarName' in metadata ? metadata.CalendarName : id

    if (dl) {
        res
            .header('Content-Type', 'text/calendar')
            .header('Content-Disposition', `attachment; filename="${name}.ics"`)
            .status(200)
    }
    else {
        res
            .header('Content-Type', 'text/plain; charset=utf-8')
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
    }
    catch (err: any) {
        logger.error(err, err?.message || 'Error during calendar update in updateLean()')

        return res.status(500)
            .json({ message: `Unable to perform update: ${err?.message}` })
            .end()
    }

    res.status(200).end()
})

app.get('/update', async (req, res) => {
    const { ACTIVITY_ORG_ID: orgId } = IDOActivityOptions.parse(process.env)
    const db = getFirestore()

    try {
        logger.info({ orgId }, 'Getting calendar status')
        const result = await status(db, orgId, ClockFactory.native())
        return res.status(200)
            .json(result)
    }
    catch (err: any) {
        logger.error(err, 'Error in status()')

        return res.status(500)
            .json({ message: `Unable to perform update: ${err?.message}` })
    }
})

app.options('/book/search', cors)
app.get('/book/search', cors, async (req, res) => {
    const QuerySchema = z.object({
        date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
        calendarId: z.enum(['337667']).default('337667')
    })

    const query = await QuerySchema.safeParseAsync(req.query)
    if (!query.success) {
        logger.error(query.error, 'Invalid request %o', query.error.flatten().fieldErrors)
        return res.status(400).send(JSON.stringify({
            sucesss: false,
            error: 'Invalid request: ' + Object.keys(query.error.flatten().fieldErrors).join(',')
        }))
    }

    const { ACTIVITY_ORG_ID: orgId, ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)
    const actApi = new ActivityApi(orgId, baseUrl, await cookies(), fetch)

    const { date, calendarId } = query.data

    try {
        const { data } = await actApi.fetchActivitiesOnDate(date, calendarId)
        const out = createApiFormat(data)

        res.json(out)
    }
    catch (err: any) {
        if ('response' in err) {
            const { status, statusText, url } = err.response as Response
            logger.error({ response: { status, statusText, url } }, 'Unable to fetch activities, got HTTP %d (%s)', status, statusText)
        }
        else {
            logger.error(err, 'Unable to fetch activities')
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
app.options('/book', cors)
app.post('/book', cors, async (req, res) => {
    const BookingSchema = z.object({
        title: z.string().min(3),
        description: z.string().min(3),
        location: z.string().default(''),
        date: z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/).or(
            z.string().regex(/\d{4}-\d{2}-\d{2}/)
        ),
        time: z.string().regex(/[0-9][0-9]:[0-9][0-9]/),
        duration: z.number().min(30).max(300),
        password: z.enum(['Ceylon2023']),
        calendarId: z.enum(['337667']).default('337667')
    })

    const { ACTIVITY_ORG_ID: orgId, ACTIVITY_BASE_URL: baseUrl } = IDOActivityOptions.parse(process.env)

    const data = await BookingSchema.safeParseAsync(req.body)
    if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, calendarId, ...event } = data.data

        const actApi = new ActivityApi(orgId, baseUrl, await cookies(), fetch)

        logger.info({ event }, 'Booking activity')
        try {
            const { activityId } = await actApi.bookActivity(calendarId, event)
            res.status(200).json({
                success: true,
                id: activityId
            })

            if (activityId === 0) {
                logger.info({ event }, 'Testing complete, skipping update schedule.')
            }
            else {
                logger.info({ event }, 'Triggering update of activity in cloud schduler.')
                triggerAsyncActivityUpdate()
            }
        }
        catch (err: any) {
            if ('response' in err) {
                const { status, statusText, url } = err.response as Response
                logger.error({ response: { status, statusText, url } }, 'Unable to complete booking, got HTTP %d (%s)', status, statusText)
            }
            else {
                logger.error(err, 'Unable to complete booking, unknown error')
            }
            res.status(500).json({
                sucesss: false,
                error: 'Unable to complete booking'
            })
        }
    }
    else {
        logger.error({ fieldErrors: data.error.flatten().fieldErrors, body: req.body }, 'Validation of request failed: %o', data.error.flatten().fieldErrors)
        res.status(400).json({
            sucesss: false,
            error: 'Invalid booking: ' + Object.keys(data.error.flatten().fieldErrors).join(',')
        })
    }
})

function triggerAsyncActivityUpdate() {
    const { GCLOUD_PROJECT } = GCloudOptions.parse(process.env)
    const schduler = new CloudSchedulerClient({ projectId: GCLOUD_PROJECT })
    const jobName = 'calendar-update-lean-5m'
    schduler.runJob({ name: `projects/${GCLOUD_PROJECT}/locations/europe-west6/jobs/${jobName}` })
        .then(() => logger.info('Schduling of %s complete!', jobName))
        .catch((err: any) => logger.warn(err, 'Schduling of %s failed!', jobName))
}

export default app
