import request from 'supertest'
import app from './competitions-api'

// Mock Firebase Admin to avoid initialization issues in tests
jest.mock('firebase-admin/app', () => ({
    initializeApp: jest.fn(),
}))

jest.mock('@google-cloud/storage', () => ({
    Storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
            file: jest.fn(() => ({
                cloudStorageURI: { toString: () => 'gs://test' },
                publicUrl: () => 'https://publicurl.ics',
                exists: jest.fn(() => Promise.resolve([false])),
                save: jest.fn(() => Promise.resolve()),
                makePublic: jest.fn(() => Promise.resolve()),
                download: jest.fn(() => Promise.resolve([Buffer.from('[]')])),
            })),
        })),
    })),
}))
// Mock cross-fetch for regular tests
jest.mock('cross-fetch', () => {
    const mockFetch = jest.fn(() => Promise.resolve({
        ok: true,
        headers: {
            get: jest.fn(() => 'sid=123456789;')
        },
        text: () => Promise.resolve(`
            <html>
                <table class="dynamicTable">
                    <tr class="cwEven">
                        <td>Test Competition</td>
                        <td>2025-08-15</td>
                        <td>Test Branch</td>
                        <td>N/X/?</td>
                        <td>öppen</td>
                        <td>Stockholm</td>
                        <td>Test Organizer</td>
                        <td>Test Fed</td>
                        <td>2025-08-10</td>
                        <td></td>
                    </tr>
                    <tr class="cwOdd">
                        <td>Another Competition</td>
                        <td>2025-08-16</td>
                        <td>Test Branch</td>
                        <td>-</td>
                        <td>gp</td>
                        <td>Stockholm</td>
                        <td>Test Organizer</td>
                        <td>Test Fed</td>
                        <td>2025-08-10</td>
                        <td></td>
                    </tr>
                    <tr class="cwEven">
                        <td>Combined Event A</td>
                        <td>2025-08-20</td>
                        <td>Test Branch</td>
                        <td>A/B/C</td>
                        <td>öppen</td>
                        <td>Göteborg</td>
                        <td>Same Organizer</td>
                        <td>Fed A</td>
                        <td>2025-08-18</td>
                        <td></td>
                    </tr>
                    <tr class="cwOdd">
                        <td>Combined Event B</td>
                        <td>2025-08-20</td>
                        <td>Test Branch</td>
                        <td>D/E/F</td>
                        <td>gp</td>
                        <td>Göteborg</td>
                        <td>Same Organizer</td>
                        <td>Fed B</td>
                        <td>2025-08-19</td>
                        <td></td>
                    </tr>
                </table>
            </html>`)
    }))
    
    return {
        __esModule: true,
        default: mockFetch
    }
})

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
        expect(response.body).toHaveProperty('size', 3) // 4 competitions, "Another Competition" kept, combined into 3 events
        expect(response.body).toHaveProperty('url', 'https://publicurl.ics')
    })

    it('should handle query parameters in POST /update', async () => {
        const response = await request(app)
            .post('/update?system=BRR')
            .expect(200)

        expect(response.body).toHaveProperty('data')
        expect(response.body).toHaveProperty('size', 2) // 4 competitions, "Another Competition" filtered out for BRR, combined into 2 events
        expect(response.body).toHaveProperty('url', 'https://publicurl.ics')
    })

    it('should handle invalid endpoints gracefully', async () => {
        const response = await request(app)
            .get('/nonexistent')

        expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should combine competitions with same date, city, and organizer', async () => {
        const response = await request(app)
            .post('/update') // No system parameter, so all competitions should be included
            .expect(200)

        const icalData = response.body.data
        
        // Check that the combined event name contains both competition names
        expect(icalData).toContain('Combined Event A / Combined Event B')
        
        // Check that we have the expected number of events
        const eventCount = (icalData.match(/BEGIN:VEVENT/g) || []).length
        expect(eventCount).toBe(3) // 4 competitions: Test Competition, Another Competition, Combined Event A/B -> 3 events
        
        // Verify combined event has combined classes (allow for line wrapping)
        expect(icalData).toMatch(/A\/B\/C\s*\/\s*D\/E\/F/)
    })

    // Integration test - skipped by default to avoid external API calls in CI
    it.skip('should fetch real competitions data from dans.se', async () => {
        // Unmock cross-fetch for this test to make real API calls
        jest.unmock('cross-fetch')
        
        // Re-import to get the real implementation
        const { fetchCompetitions: realFetchCompetitions } = await import('./lib/competitions.js')
        
        const calendar = await realFetchCompetitions()
        
        expect(calendar).toBeDefined()
        expect(typeof calendar.toString()).toBe('string')
        expect(calendar.length()).toBeGreaterThanOrEqual(0)
        
        // Verify it's a valid iCal format
        const icalString = calendar.toString()
        expect(icalString).toContain('BEGIN:VCALENDAR')
        expect(icalString).toContain('END:VCALENDAR')
        expect(icalString).toContain('PRODID')

        console.log('Fetched competitions count:', calendar.length())

    }, 30000) // 30 second timeout for external API call
})
