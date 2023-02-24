#!/bin/bash

# Read env file
# shellcheck disable=SC2046
export $(grep -v '^#' .env | xargs)

gcloud services enable secretmanager.googleapis.com --project "${GCLOUD_PROJECT}"

createSecret() {
    # Create secret
    echo -n "${2}"| gcloud secrets create "${1}" \
        --project="${GCLOUD_PROJECT}" \
        --replication-policy="automatic" --data-file=- \
        & echo "Secret ${2} created!";
    
    # Authorize compute to access secret
    gcloud secrets add-iam-policy-binding "${1}" \
        --member="serviceAccount:${GCLOUD_COMPUTE_ACCOUNT}" \
        --project="${GCLOUD_PROJECT}" \
        --role=roles/secretmanager.secretAccessor
}

createSecret "ACTIVITY_ORG_ID", "${ACTIVITY_ORG_ID}"
createSecret "ACTIVITY_BASE_URL" "${ACTIVITY_BASE_URL}"
createSecret "ACTIVITY_USERNAME" "${ACTIVITY_USERNAME}"
createSecret "ACTIVITY_PASSWORD" "${ACTIVITY_PASSWORD}"
