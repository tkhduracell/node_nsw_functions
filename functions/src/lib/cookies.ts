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
    // Undefined is not allowed in Firestore
    const data = cookies.map(ck => {
        const obj: Record<string, any> = { ...ck }
        for (const key in obj) {
            if (obj[key] === undefined) {
                delete obj[key];
            }
        }
        return obj
    })
    
    await db.collection('browser')
        .doc(`org-${orgId}`)
        .set({ data, updated_at: FieldValue.serverTimestamp() }, { merge: false })
}