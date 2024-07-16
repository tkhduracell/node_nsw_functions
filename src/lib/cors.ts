import setupCors, { CorsOptions } from 'cors';

export const ALLOWED_ORIGINS = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://192.168.68.54:3000',
    'http://localhost:8080',
    'http://localhost',
    'https://localhost',
    'https://nackswinget.se'
]

const options: CorsOptions = {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version', 'X-App-Id', 'X-App-Build', 'X-App-Name'],
}

export const cors = setupCors(options)
