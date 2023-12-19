import { Firestore } from "firebase-admin/firestore"
import { Protocol } from "puppeteer"

export async function fetchCookies(db: Firestore, orgId: string): Promise<Protocol.Network.CookieParam[]> {
    const document = await db.collection('browser')
        .doc(`org-${orgId}`)
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