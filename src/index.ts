import 'source-map-support/register'

import { http } from '@google-cloud/functions-framework'
import { Storage } from '@google-cloud/storage'
import { getMessaging } from 'firebase-admin/messaging'
import { format, formatDistance } from 'date-fns'
import { sv } from 'date-fns/locale'
import { config } from 'dotenv'

import z from 'zod'

import { GCloudOptions } from './env'
import { calendar } from './calendar'
import { fetchCompetitions } from './comp'

config()

http('get', async (req, res) => {
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

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="${metadata['CalendarName']}.ics"`)
        .status(200)

    bucket
        .file(`cal_${id}.ics`)
        .createReadStream()
        .pipe(res, { end: true })
});

http('update', async (req, res) => {
    const {
        GCLOUD_PROJECT,
        GCLOUD_BUCKET,
    } = GCloudOptions.parse(process.env)
    const storage = new Storage({ projectId: GCLOUD_PROJECT });
    const bucket = storage.bucket(GCLOUD_BUCKET)

    const { dryrun } = z.object({ dryrun: z.enum(['true', 'false']).optional() }).parse(req.query)

    if (dryrun === 'true') {
        await mockNotification()
        return
    }

    await calendar(bucket, true, true)

    res.sendStatus(200)
});


import express from 'express'
import path from 'path'

const app = express()
app.use(express.static(path.join(__dirname, 'static'), {}))
app.post('/subscribe', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().subscribeToTopic(token, topic)
    console.log('Successfully subscribed to topic:', response)
    return res.status(200).send(response)
})
app.post('/unsubscribe', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().unsubscribeFromTopic(token, topic)
    console.log('Successfully unsubscribed from topic:', response)
    return res.status(200).send(response)
})
app.post('/trigger', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { topic } = z.object({ topic: z.string().optional() }).parse(req.query)
    const response = await mockNotification(topic)
    return res.status(200).send(response)
})

http('notifications-api', app)

http('competitions', async (req, res) => {
    const classTypes = z.enum(['X', 'N', 'R', '']).default('').parse(req.query.classTypes)

    const cal = await fetchCompetitions(classTypes)

    await cal.save('/tmp/comp.ics')

    res
        .setHeader('Content-Type', 'text/calendar')
        .setHeader('Content-Disposition', `attachment; filename="comp_${classTypes || 'all'}.ics"`)
        .status(200)
        .sendFile('/tmp/comp.ics')
});

async function mockNotification(topicName = 'calendar-337667') {
    const start = new Date();
    const end = new Date(new Date().getTime() + 3600000 * 3)
    const summary = "Friträning"
    const message = {
        notification: {
            title: 'Ny friträning inlagd',
            body: start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary,
            image: "data:image/png;base64,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"
        },
        topic: topicName,
    }
    console.log({ message })
    const resp = await getMessaging().send(message)

    console.log({ resp })
    return resp
}