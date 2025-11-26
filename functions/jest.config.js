/** @type {import('ts-jest').JestConfigWithTsJest} */

// Set timezone for consistent test results
process.env.TZ = 'Europe/Stockholm'

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        '<rootDir>/src/**/*.(test).{js,jsx,ts,tsx}',
        '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}'
    ],
    setupFiles: ['dotenv/config'],
}
