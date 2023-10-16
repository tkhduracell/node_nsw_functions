import express from 'express'
import path from 'path'
import z from 'zod'

import { initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { format, formatDistance } from 'date-fns'
import { sv } from 'date-fns/locale'
import { getFirestore } from 'firebase-admin/firestore'


const app = express()

if (require.main === module) {
    const port = process.env.PORT ?? 3000
    initializeApp()
    app.listen(port, () => console.log(`Listening on port ${port}`))
}

app.post('/status', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
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
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().subscribeToTopic(token, topic)

    const db = getFirestore()
    await db.collection('tokens').doc(token).set({ created_at: new Date(), topic }, { merge: true })

    console.log('Successfully subscribed to topic:', response)
    return res.status(200).send(response)
})

app.post('/unsubscribe', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { token, topic } = z.object({ token: z.string(), topic: z.string() }).parse(req.query)
    const response = await getMessaging().unsubscribeFromTopic(token, topic)

    const db = getFirestore()
    await db.collection('tokens').doc(token).delete()

    console.log('Successfully unsubscribed from topic:', response)
    return res.status(200).send(response)
})

app.post('/trigger', async (req, res) => {
    res.header('Access-Control-Allow-Origin', 'nackswinget.se')
    const { topic } = z.object({ topic: z.string().optional() }).parse(req.query)
    const response = await mockNotification(topic)
    return res.status(200).send(response)
})

app.use(express.static(path.join(__dirname, '..', 'static')))

export async function mockNotification(topicName = 'calendar-337667') {
    const start = new Date();
    const end = new Date(new Date().getTime() + 3600000 * 3)
    const summary = "Friträning"
    const message = {
        notification: {
            title: 'Ny friträning inlagd',
            body: start && end ? `${format(start, 'yyyy-MM-dd')} kl ${format(start, 'HH:mm')} (${formatDistance(start, end, { locale: sv })}) ${summary}` : summary,
            image: "https://nackswinget.se/wp-content/uploads/2023/01/6856391A-C153-414C-A1D0-DFD541889953.jpeg"
        },
        topic: topicName,
    }
    console.log({ message })
    const resp = await getMessaging().send(message)

    console.log({ resp })
    return resp
}

export default app