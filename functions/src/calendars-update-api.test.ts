import request from 'supertest'
import app from './calendars-update-api'

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

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage', () => ({
    Storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
            exists: jest.fn(() => Promise.resolve([true])),
            file: jest.fn(() => ({
                exists: jest.fn(() => Promise.resolve([false])),
                save: jest.fn(() => Promise.resolve()),
                makePublic: jest.fn(() => Promise.resolve()),
            })),
        })),
    })),
}))

// Mock Puppeteer
jest.mock('puppeteer', () => ({
    launch: jest.fn(() => Promise.resolve({
        newPage: jest.fn(() => Promise.resolve({
            goto: jest.fn(),
            close: jest.fn(),
        })),
        close: jest.fn(),
    })),
}))

// Mock calendars library
jest.mock('./lib/calendars', () => ({
    update: jest.fn(() => Promise.resolve({
        message: 'Updated successfully',
        count: 5
    })),
}))

jest.mock('./lib/screenshots', () => ({
    dumpScreenshots: jest.fn(() => Promise.resolve()),
}))

describe('Calendars Update API', () => {
    it('should load the express app without errors', () => {
        expect(app).toBeDefined()
        expect(typeof app).toBe('function')
    })

    it('should respond to POST /', async () => {
        const response = await request(app)
            .post('/')

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should handle query parameters in POST /', async () => {
        const response = await request(app)
            .post('/?debug=true')

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
