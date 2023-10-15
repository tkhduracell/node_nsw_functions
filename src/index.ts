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

async function mockNotification() {
    const topicName = `calendar-337667`;
        const start = new Date();
        const end = new Date(new Date().getTime() + 3600000 * 3)
        const summary = "Friträning"
        const message = {
          notification: {
            title: 'Ny friträning inlagd',
            body: start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary
          },
          topic: topicName,
        }
        console.log({ message })
        const resp = await getMessaging().send(message)

        console.log({ resp })
}