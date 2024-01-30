import setupCors, { CorsOptions } from 'cors';

const options: CorsOptions = {
    origin: [
        'capacitor://localhost',
        'ionic://localhost',
        'http://localhost',
        'http://localhost:5173',
        'http://localhost:8080',
        'https://localhost',
        'https://nackswinget.se'
    ]
}

export const cors = setupCors(options)
