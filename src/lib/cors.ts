import setupCors, { CorsOptions } from 'cors';

export const ALLOWED_ORIGINS = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:5173',
    'http://localhost:8080',
    'https://localhost',
    'https://nackswinget.se'
]

const options: CorsOptions = {
    origin: ALLOWED_ORIGINS
}

export const cors = setupCors(options)
