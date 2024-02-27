import { logger, loggerMiddleware } from './logging'
import express from 'express'
import { join } from 'path'
import z from 'zod'

import { initializeApp } from 'firebase-admin/app'
import { type Message, getMessaging } from 'firebase-admin/messaging'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { cors } from './lib/cors'
import { prettyJson } from './middleware'

const app = express()
app.use(loggerMiddleware)
app.use(cors)
app.use(express.json())
app.use(prettyJson)

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { logger.info(`Listening on port ${port}`) })
}

type Token = {
    topic: string,
    topics?: string[],
    created_at?: Timestamp,
    updated_at: Timestamp
}

app.post('/status', async (req, res) => {
    const { token, topic } = z.object({ token: z.string(), topic: z.string().default('calendar-337667') }).parse(req.query)
    const db = getFirestore()
    const result = await db.collection('tokens').doc(token).get()
    if (result.exists) {
        const { topic: currentTopic, topics} = result.data() as Token
        // Check old field and new field
        const subscribed = currentTopic === topic || (topics && topics.includes(topic))
        res.status(200).send({
            subscribed,
            data: result.data() as Token
        }).end()
    } else {
        return res.status(200).send({ subscribed: false })
    }
})

app.post('/subscribe', async (req, res) => {
    const { token, topic } = z.object({ token: z.string(), topic: z.string().default('calendar-337667') }).parse(req.query)
    const response = await getMessaging().subscribeToTopic(token, topic)

    const db = getFirestore()
    const old = (await db.collection('tokens').doc(token).get()).data() as Token | undefined

    await db.collection('tokens').doc(token).set({
        updated_at: FieldValue.serverTimestamp(),
        topics: old && old.topic ? FieldValue.arrayUnion(topic, old) : FieldValue.arrayUnion(topic),
        topic: FieldValue.delete()
    }, { merge: true })

    logger.info('Successfully subscribed to topic', { topic, response })
    return res.status(200).send(response)
})

app.post('/unsubscribe', async (req, res) => {
    const { token, topic } = z.object({ token: z.string(), topic: z.string().default('calendar-337667') }).parse(req.query)
    const response = await getMessaging().unsubscribeFromTopic(token, topic)

    const db = getFirestore()
    await db.collection('tokens').doc(token).set({
        updated_at: FieldValue.serverTimestamp(),
        topics: FieldValue.arrayRemove(topic),
        topic: FieldValue.delete()
    }, { merge: true })

    logger.info('Successfully unsubscribed from topic', { topic, response})
    return res.status(200).send(response)
})

app.post('/trigger', async (req, res) => {
    const { topic, token, title, body } = z.object({
        topic: z.string().optional(),
        token: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional()
    }).parse(req.query)
    const response = await notification({ topic, token, title, body })
    return res.status(200).send(response)
})

app.use(express.static(join(__dirname, '..', 'static')))

export async function notification ({ token, topic, title, body }: { token?: string, topic?: string, title?: string, body?: string }) {
    const notification: Message['notification'] = {
        title: title ?? 'The-dans på Söndag igen!',
        body: body ?? 'Vi kör The-dans på Söndag igen kl 15-17. Välkomna!',
        imageUrl: "https://nackswinget.se/wp-content/uploads/2024/01/The-dans-980x560.png"
    }
    const webpush: Message['webpush'] = {
        notification: {
            icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg',
            image: notification.imageUrl,
        }
    }

    let message: Message
    if (token) {
        message = { notification, webpush, token }
    } else if (topic) {
        message = { notification, webpush, topic }
    } else {
        throw new Error(`Either 'token' or 'topic' must be provided`)
    }

    logger.info({ message })
    const resp = await getMessaging().send(message)
    logger.info({ resp })
    return resp
}

export default app
