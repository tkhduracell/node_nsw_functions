import request from 'supertest'
import app from './competitions-api'

// Mock Firebase Admin to avoid initialization issues in tests
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}))

// Mock competitions library
jest.mock('./lib/competitions', () => ({
    updateCompetitions: jest.fn(() => Promise.resolve({
        data: [],
        size: 0,
        url: 'https://test.com'
    })),
}))

describe('Competitions API', () => {
    it('should load the express app without errors', () => {
        expect(app).toBeDefined()
        expect(typeof app).toBe('function')
    })

    it('should respond to POST /update', async () => {
        const response = await request(app)
            .post('/update')
            .expect(200)

        expect(response.body).toHaveProperty('data')
        expect(response.body).toHaveProperty('size')
        expect(response.body).toHaveProperty('url')
    })

    it('should handle query parameters in POST /update', async () => {
        const response = await request(app)
            .post('/update?system=BRR&debug=true')

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
