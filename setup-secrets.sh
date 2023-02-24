#!/bin/bash

# shellcheck disable=SC2046
export $(grep -v '^#' .env | xargs)

gcloud services enable secretmanager.googleapis.com --project "${GCLOUD_PROJECT}"

createSecret() {
    echo -n "${2}"| gcloud secrets create "${1}" \
        --project="${GCLOUD_PROJECT}" \
        --replication-policy="automatic" --data-file=- \
        & echo "Secret ${2} created!";
}

createSecret "ACTIVITY_ORG_ID", "${ACTIVITY_ORG_ID}"
createSecret "ACTIVITY_BASE_URL" "${ACTIVITY_BASE_URL}"
createSecret "ACTIVITY_USERNAME" "${ACTIVITY_USERNAME}"
createSecret "ACTIVITY_PASSWORD" "${ACTIVITY_PASSWORD}"

