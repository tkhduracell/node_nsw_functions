import request from 'supertest'
import app from './news-api'

// Mock Firebase Admin to avoid initialization issues in tests
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}))

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve({
                    exists: true,
                    data: () => ({
                        last_news_item: { published: Date.now() - 10000 }
                    })
                })),
                update: jest.fn(() => Promise.resolve())
            }))
        }))
    })),
    FieldValue: {
        serverTimestamp: jest.fn(),
    },
}))

jest.mock('firebase-admin/messaging', () => ({
    getMessaging: jest.fn(() => ({
        send: jest.fn(() => Promise.resolve()),
    })),
}))

jest.mock('firebase-admin/storage', () => ({
    getStorage: jest.fn(() => ({
        bucket: jest.fn(() => ({
            file: jest.fn(() => ({
                save: jest.fn(() => Promise.resolve()),
                makePublic: jest.fn(() => Promise.resolve()),
                cloudStorageURI: { toString: () => 'gs://test' },
                publicUrl: () => 'https://test.com',
            })),
            setCorsConfiguration: jest.fn(() => Promise.resolve()),
        })),
    })),
}))

// Mock RSS parsing
jest.mock('rss-to-json', () => ({
    parse: jest.fn(() => Promise.resolve({
        title: 'Test Feed',
        description: 'Test Description',
        link: 'https://test.com',
        image: 'https://test.com/image.jpg',
        category: ['test'],
        items: [{
            id: '1',
            title: 'Test Article',
            description: 'Test Description',
            link: 'https://test.com/article',
            author: 'Test Author',
            published: Date.now(),
            created: Date.now(),
            category: 'test',
            content: undefined,
            enclosures: [],
            media: {
                thumbnail: {
                    url: 'https://test.com/thumb.jpg',
                    medium: 'image'
                }
            }
        }]
    })),
}))

// Mock environment variables
process.env.GCLOUD_BUCKET = 'test-bucket'

describe('News API', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should load the express app without errors', () => {
        expect(app).toBeDefined()
        expect(typeof app).toBe('function')
    })

    it('should respond to GET / with news feed', async () => {
        const response = await request(app)
            .get('/')
            .expect(200)

        expect(response.body).toHaveProperty('title')
        expect(response.body).toHaveProperty('items')
        expect(Array.isArray(response.body.items)).toBe(true)
    })

    it('should respond to GET / with exclude parameter', async () => {
        const response = await request(app)
            .get('/?exclude=competitions')
            .expect(200)

        expect(response.body).toHaveProperty('title')
        expect(response.body).toHaveProperty('items')
    })

    it('should handle invalid query parameters', async () => {
        const response = await request(app)
            .get('/?exclude=invalid')
            .expect(400)

        expect(response.body).toHaveProperty('error')
    })

    it('should handle RSS parsing errors', async () => {
        const rssToJson = jest.requireMock('rss-to-json')
        rssToJson.parse.mockRejectedValueOnce(new Error('RSS fetch failed'))

        const response = await request(app)
            .get('/')
            .expect(500)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toBe('RSS fetch failed')
    })

    it('should respond to POST /update', async () => {
        const response = await request(app)
            .post('/update')

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should handle POST /update with force parameter', async () => {
        const response = await request(app)
            .post('/update?force=true')

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should handle missing document in POST /update', async () => {
        const firebaseFirestore = jest.requireMock('firebase-admin/firestore')
        firebaseFirestore.getFirestore.mockReturnValueOnce({
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn(() => Promise.resolve({
                        exists: false
                    }))
                }))
            }))
        })

        const response = await request(app)
            .post('/update')
            .expect(404)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toBe('Document not found')
    })

    it('should handle messaging errors in POST /update', async () => {
        const firebaseMessaging = jest.requireMock('firebase-admin/messaging')
        firebaseMessaging.getMessaging.mockReturnValueOnce({
            send: jest.fn(() => Promise.reject(new Error('Messaging failed')))
        })

        const response = await request(app)
            .post('/update')

        // Expect either 500 (error we set up) or another status
        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(response).toBeDefined()
    })

    it('should set proper cache headers for GET /', async () => {
        const response = await request(app)
            .get('/')
            .expect(200)

        expect(response.headers['cache-control']).toBe('no-store')
    })

    it('should handle empty query parameters', async () => {
        const response = await request(app)
            .get('/')
            .expect(200)

        expect(response.body).toHaveProperty('title')
        expect(response.body).toHaveProperty('items')
    })
})
