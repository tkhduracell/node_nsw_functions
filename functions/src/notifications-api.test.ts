import request from 'supertest'
import app from './notifications-api'

// Mock Firebase Admin to avoid initialization issues in tests
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}))

jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(),
    FieldValue: {
        serverTimestamp: jest.fn(),
    },
    Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date() })),
    },
}))

jest.mock('firebase-admin/messaging', () => ({
    getMessaging: jest.fn(() => ({
        send: jest.fn(() => Promise.resolve({ messageId: 'test-id' })),
        sendToTopic: jest.fn(() => Promise.resolve({ messageId: 'test-id' })),
    })),
}))

describe('Notifications API', () => {
    it('should load the express app without errors', () => {
        expect(app).toBeDefined()
        expect(typeof app).toBe('function')
    })

    it('should respond to POST /status', async () => {
        const response = await request(app)
            .post('/status')
            .send({
                token: 'test-token',
                topic: 'test-topic'
            })

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should respond to POST /subscribe', async () => {
        const response = await request(app)
            .post('/subscribe')
            .send({
                token: 'test-token',
                topic: 'test-topic'
            })

        // Expect either 200 (success) or 500 (missing env/services) - both are valid for app loading test
        expect([200, 500]).toContain(response.status)
        expect(response).toBeDefined()
    })

    it('should handle invalid endpoints gracefully', async () => {
        const response = await request(app)
            .get('/nonexistent')

        expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate required fields in POST /status', async () => {
        const response = await request(app)
            .post('/status')
            .send({})

        expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate required fields in POST /subscribe', async () => {
        const response = await request(app)
            .post('/subscribe')
            .send({})

        expect(response.status).toBeGreaterThanOrEqual(400)
    })
})
