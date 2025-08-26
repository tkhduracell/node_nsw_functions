import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { type Cookie } from 'puppeteer'

export async function fetchCookies(db: Firestore, orgId: string): Promise<Cookie[]> {
    const document = await db.collection('browser')
        .doc(`org-${orgId}`)
        .get()

    if (!document.exists) {
        throw new Error('No cookies in database')
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const data = document.data()! as { data: Cookie[] }

    if ('data' in data) {
        return data.data
    }

    throw new Error('No cookies in database')
}

export async function storeCookies(db: Firestore, orgId: string, cookies: Cookie[]): Promise<void> {
    await db.collection('browser')
        .doc(`org-${orgId}`)
        .set({ data: cookies, updated_at: FieldValue.serverTimestamp() }, { merge: false })
}