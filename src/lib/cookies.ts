import { Firestore } from "firebase-admin/firestore"
import { IDOActivityOptions } from "../env"
import { Protocol } from "puppeteer"

export async function fetchCookies(db: Firestore) {
    const { ACTIVITY_ORG_ID } = IDOActivityOptions.parse(process.env)

    const document = await db.collection('browser')
        .doc(`org-${ACTIVITY_ORG_ID}`)
        .get()

    if (!document.exists) {
        console.warn('No cookies in database')
    }

    const { data: cookies } = document.data()! as { data: Protocol.Network.CookieParam[] }

    return cookies
}