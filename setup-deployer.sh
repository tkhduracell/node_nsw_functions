#!/bin/bash

# Read env file
# shellcheck disable=SC2046
export $(grep -v '^#' .env | xargs)

gcloud services enable artifactregistry.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable cloudfunctions.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable cloudbuild.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable run.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable secretmanager.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable cloudresourcemanager.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable cloudscheduler.googleapis.com --project "${GCLOUD_PROJECT}"
gcloud services enable googlecloudmessaging.googleapis.com --project "${GCLOUD_PROJECT}"

GCLOUD_SERVICE_ACCOUNT=github-deployer-account
GCLOUD_SERVICE_ACCOUNT_ROLE=functions.deployer
GCLOUD_SERVICE_ACCOUNT_EMAIL="${GCLOUD_SERVICE_ACCOUNT}@${GCLOUD_PROJECT}.iam.gserviceaccount.com"

GCLOUD_SCHEDULER_REGION=europe-west6

gcloud iam roles create ${GCLOUD_SERVICE_ACCOUNT_ROLE} \
    --project "${GCLOUD_PROJECT}" \
    --title "GitHub Function Deployer" \
    --stage "GA" \
    --description "This role has permission to deploy cloud functions" \
    --permissions="cloudfunctions.functions.get,cloudfunctions.functions.sourceCodeSet,cloudfunctions.operations.get,cloudfunctions.functions.update,resourcemanager.projects.get,run.services.create,run.services.update,run.services.getIamPolicy,run.services.setIamPolicy,cloudscheduler.jobs.update,cloudscheduler.jobs.create"

gcloud projects add-iam-policy-binding "${GCLOUD_PROJECT}" \
      --member="serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}" \
      --role="projects/${GCLOUD_PROJECT}/roles/${GCLOUD_SERVICE_ACCOUNT_ROLE}"

# Allow service account to assume cloud functions service account (first gen)
gcloud iam service-accounts add-iam-policy-binding "${GCLOUD_PROJECT}@appspot.gserviceaccount.com" \
    --project="${GCLOUD_PROJECT}" \
    --role roles/iam.serviceAccountUser \
    --member "serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}"


# Allow service account to assume cloud functions service account (second gen)
gcloud iam service-accounts add-iam-policy-binding "${GCLOUD_COMPUTE_ACCOUNT}" \
    --project="${GCLOUD_PROJECT}" \
    --role roles/iam.serviceAccountUser \
    --member "serviceAccount:${GCLOUD_SERVICE_ACCOUNT_EMAIL}"

gcloud scheduler jobs create http calendar-update-half-hourly --project "${GCLOUD_PROJECT}" \
    --location ${GCLOUD_SCHEDULER_REGION} \
    --schedule "*/30 * * * *" \
    --time-zone "Europe/Stockholm" \
    --uri "https://${GCLOUD_REGION}-${GCLOUD_PROJECT}.cloudfunctions.net/calendar-export-update" \
    --http-method GET \
    --description="calendar-export-update: Update NSW GCS ics files (half-hourly)"
