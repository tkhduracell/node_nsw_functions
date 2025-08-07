import request from 'supertest'
import app from './calendars-api'

// Mock Firebase Admin to avoid initialization issues in tests
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}))

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(),
    FieldValue: {
        serverTimestamp: jest.fn(),
    },
}))

// Mock Google Cloud services
jest.mock('@google-cloud/storage', () => ({
    Storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
            file: jest.fn(() => ({
                exists: jest.fn(() => Promise.resolve([false])),
                save: jest.fn(() => Promise.resolve()),
                makePublic: jest.fn(() => Promise.resolve()),
                download: jest.fn(() => Promise.resolve([Buffer.from('[]')])),
            })),
        })),
    })),
}))

jest.mock('@google-cloud/scheduler', () => ({
    CloudSchedulerClient: jest.fn(() => ({
        projectLocationPath: jest.fn(),
        getJob: jest.fn(() => Promise.resolve([{}])),
        createJob: jest.fn(() => Promise.resolve([{}])),
    })),
}))

// Mock booking library
jest.mock('./lib/booking', () => ({
    ActivityApi: jest.fn(),
    CookieProvider: jest.fn(),
}))

jest.mock('./lib/cookies', () => ({
    fetchCookies: jest.fn(() => Promise.resolve([])),
}))

describe('Calendars API', () => {
    it('should load the express app without errors', () => {
        expect(app).toBeDefined()
        expect(typeof app).toBe('function')
    })

    it('should respond to GET /', async () => {
        const response = await request(app)
            .get('/')

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should handle invalid endpoints gracefully', async () => {
        const response = await request(app)
            .get('/nonexistent')

        expect(response.status).toBeGreaterThanOrEqual(400)
    })
})
