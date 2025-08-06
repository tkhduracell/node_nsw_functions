# Nackswinget Workspace

A monorepo containing cloud functions and mobile application for the Nackswinget platform.

## Package Manager

This project uses [pnpm](https://pnpm.io/) as the package manager for better performance, disk efficiency, and stricter dependency resolution.

## Workspace Structure

This monorepo is organized as a pnpm workspace with three packages:

```
.
├── package.json                 # @nackswinget/workspace (root coordinator)
├── pnpm-workspace.yaml         # Workspace configuration
├── functions/                  # Backend cloud functions
│   ├── package.json           # @nackswinget/functions
│   ├── src/                   # Function source code
│   └── clean-artifacts.sh     # Build cleanup script
└── apps/
    └── mobile/                # Ionic Vue mobile app
        ├── package.json       # @nackswinget/mobile
        ├── src/              # Mobile app source
        ├── android/          # Android build files
        └── ios/              # iOS build files
```

### Packages

- **`@nackswinget/workspace`** - Root workspace coordinator with shared scripts
- **`@nackswinget/functions`** - Cloud Functions and backend APIs
- **`@nackswinget/mobile`** - Ionic Vue mobile application

## Development

### Prerequisites

- Node.js 20+
- pnpm 10.8.0+

### Installation

```bash
# Install pnpm globally if not already installed
npm install -g pnpm

# Install dependencies for all packages
pnpm install
```

### Building

```bash
# Build all packages
pnpm build

# Build specific packages
pnpm --filter @nackswinget/functions run build
pnpm --filter @nackswinget/mobile run build
```

### Testing

```bash
# Run tests for all packages
pnpm test

# Run tests for specific packages
pnpm --filter @nackswinget/functions run test
pnpm --filter @nackswinget/mobile run test:unit
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific packages
pnpm --filter @nackswinget/functions run lint
pnpm --filter @nackswinget/mobile run lint
```

### Development Servers

```bash
# Start functions development server
pnpm --filter @nackswinget/functions run dev

# Start mobile development server
pnpm --filter @nackswinget/mobile run dev
```

## Deployment

### Cloud Functions

Functions are automatically deployed via GitHub Actions on push to main:

```bash
# Manual deployment (from functions/ directory)
cd functions
gcloud functions deploy your-function-name
```

### Mobile App

#### Android

```bash
# Build for Android
pnpm --filter @nackswinget/mobile run android:build

# Open in Android Studio
pnpm --filter @nackswinget/mobile run android:open
```

#### iOS

```bash
# Build for iOS
pnpm --filter @nackswinget/mobile run ios:build

# Open in Xcode
pnpm --filter @nackswinget/mobile run ios:open
```

## API Documentation

### SSL Certificates

Generate development certificates:

```bash
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
```

### Booking API

Example API call:

```bash
curl 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book' \
  --data-raw '{"title":"Test","location":"Ceylon","password":"XXX","date":"2024-01-23T23:00:00.000Z","time":"15:00","duration":60,"description":"Bob - 07026XXXXX"}'
```

## Local GitHub Actions Testing

This project uses [`act`](https://github.com/nektos/act) to run GitHub Actions workflows locally for testing before pushing to GitHub.

### Prerequisites

Install `act`:
```bash
# macOS
brew install act

# Or using GitHub CLI
gh extension install https://github.com/nektos/gh-act
```

### Running Workflows Locally

Test specific jobs from the pull request workflow:

```bash
# Test the functions build job
act pull_request -j build-functions --container-architecture linux/amd64

# Test the functions test job  
act pull_request -j test-functions --container-architecture linux/amd64

# Test the lint job
act pull_request -j lint-functions --container-architecture linux/amd64

# Test the mobile app build job
act pull_request -j build-apps --container-architecture linux/amd64
```

Test all pull request jobs:
```bash
act pull_request --container-architecture linux/amd64
```

### Notes

- The `--container-architecture linux/amd64` flag ensures compatibility across different host architectures
- Local testing helps catch issues before they appear in CI/CD
- Some steps that require GitHub secrets or cloud credentials will be skipped locally

## Additional Documentation

- [Android Development Guide](apps/mobile/android/README.md)
- [Functions API Reference](functions/src/README.md)
