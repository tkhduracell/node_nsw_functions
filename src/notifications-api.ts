import express from 'express'
import { join } from 'path'
import z from 'zod'

import { initializeApp } from 'firebase-admin/app'
import { type Message, getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'
import cors from 'cors'
import { prettyJson } from './middleware'

const app = express()

if (require.main === module) {
    const port = process.env.PORT ?? 8080
    initializeApp()
    app.listen(port, () => { console.log(`Listening on port ${port}`) })
}

app.use(cors({ origin: 'https://nackswinget.se' }))
app.use(express.json())
app.use(prettyJson)

app.post('/status', async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.query)
    const db = getFirestore()
    const result = await db.collection('tokens').doc(token).get()
    if (result.exists) {
        return res.status(200).send({
            subscribed: true,
            data: result.data()
        })
    } else {
        return res.status(200).send({ subscribed: false })
    }
})

app.post('/subscribe', async (req, res) => {
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().subscribeToTopic(token, topic)

    const db = getFirestore()
    await db.collection('tokens').doc(token).set({ created_at: new Date(), topic }, { merge: true })

    console.log('Successfully subscribed to topic:', response)
    return res.status(200).send(response)
})

app.post('/unsubscribe', async (req, res) => {
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().unsubscribeFromTopic(token, topic)

    const db = getFirestore()
    await db.collection('tokens').doc(token).delete()

    console.log('Successfully unsubscribed from topic:', response)
    return res.status(200).send(response)
})

app.post('/trigger', async (req, res) => {
    const { topic, title, body } = z.object({
        topic: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional()
    }).parse(req.query)
    const response = await mockNotification(topic, title, body)
    return res.status(200).send(response)
})

app.use(express.static(join(__dirname, '..', 'static')))

export async function mockNotification (
    topicName = 'calendar-337667',
    title = undefined as string | undefined,
    body = undefined as string | undefined
) {
    const message: Message = {
        notification: {
            title: title ?? 'Ny notis',
            body: body ?? 'Test av notification'
            // imageUrl: "https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg"
        },
        webpush: {
            notification: {
                icon: 'https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg'
            }
        },
        topic: topicName
    }
    console.log({ message })
    const resp = await getMessaging().send(message)

    console.log({ resp })
    return resp
}

export default app
