import { Firestore } from "firebase-admin/firestore"
import { IDOActivityOptions } from "../env"
import { Protocol } from "puppeteer"

export async function fetchCookies(db: Firestore): Promise<Protocol.Network.CookieParam[]> {
    const { ACTIVITY_ORG_ID } = IDOActivityOptions.parse(process.env)

    const document = await db.collection('browser')
        .doc(`org-${ACTIVITY_ORG_ID}`)
        .get()

    if (!document.exists) {
        throw new Error('No cookies in database')
    }

    const data = document.data()! as { data: Protocol.Network.CookieParam[] }

    if ('data' in data) {
        return data.data
    }

    throw new Error('No cookies in database')
}