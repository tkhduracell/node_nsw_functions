#!/bin/sh
set -e

tsc

gcloud \
    --project "${GCLOUD_PROJECT}" functions deploy nsw-calendar-export-get \
    --runtime=nodejs16 \
    --region="${GCLOUD_REGION}" \
    --source=. \
    --entry-point=get \
    --trigger-http \
    --allow-unauthenticated

gcloud \
    --project "${GCLOUD_PROJECT}" functions deploy nsw-calendar-export-update \
    --runtime=nodejs16 \
    --region="${GCLOUD_REGION}" \
    --source=. \
    --entry-point=update \
    --trigger-http \
    --memory=1024MB \
    --allow-unauthenticated

gcloud scheduler jobs update http nsw-calendar-update \
  --location "${GCLOUD_REGION}" \
  --schedule "0 * * * *" \
  --time-zone "Europe/Stockholm" \
  --uri "https://${GCLOUD_REGION}-${GCLOUD_PROJECT}.cloudfunctions.net/nsw-calendar-export-update" \
  --http-method GET \
  --description="nsw-calendar-export-update: Update NSW GCS ics files"

rm ./*.js