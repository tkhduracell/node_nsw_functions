README
===

## Package Manager

This project uses [pnpm](https://pnpm.io/) as the package manager for better performance and disk efficiency.

## Workspace Structure

This monorepo contains two main packages:

- **`@nackswinget/functions`** - Cloud Functions and backend APIs (in `functions/`)
- **`@nackswinget/mobile`** - Ionic Vue mobile application (in `apps/mobile/`)

### Installation

```bash
# Install dependencies for all packages
pnpm install

# Build all packages
pnpm build

# Build specific packages
pnpm --filter @nackswinget/functions run build
pnpm --filter @nackswinget/mobile run build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Certs

    openssl genrsa -out server.key 2048
    openssl req -new -key server.key -out server.csr
    openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

## Booking API

    curl 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book' \
      --data-raw '{"title":"Test","location":"Ceylon","password":"XXX","date":"2024-01-23T23:00:00.000Z","time":"15:00","duration":60,"description":"Bob - 07026XXXXX"}'

## Apps

### Android 

[apps/mobile/android/README.md](apps/mobile/android/README.md)
