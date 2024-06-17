#!/bin/bash

# Read env file
# shellcheck disable=SC2046
export $(grep -v '^#' .env | xargs)

gcloud services enable secretmanager.googleapis.com --project "${GCLOUD_PROJECT}"

fetchSecret() {
    # Read secret value
    secret_value=$(gcloud secrets versions access latest --secret="${1}" --project="${GCLOUD_PROJECT}")

    # Append secret to .env file
    echo "${1}=${secret_value}" >> .env
}

echo "" > .env
fetchSecret "ACTIVITY_ORG_ID"
fetchSecret "ACTIVITY_BASE_URL"
fetchSecret "ACTIVITY_USERNAME"
fetchSecret "ACTIVITY_PASSWORD"
