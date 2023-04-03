#!/bin/sh
set -e

npm run build

gcloud \
  --project "${GCLOUD_PROJECT}" functions deploy calendar-export-get \
  --gen2 \
  --runtime=nodejs18 \
  --region="${GCLOUD_REGION}" \
  --source=dist \
  --entry-point=get \
  --trigger-http \
  --allow-unauthenticated

gcloud \
  --project "${GCLOUD_PROJECT}" functions deploy calendar-export-update \
  --gen2 \
  --runtime=nodejs18 \
  --region="${GCLOUD_REGION}" \
  --source=dist \
  --entry-point=update \
  --trigger-http \
  --memory=1024MB \
  --allow-unauthenticated

gcloud scheduler jobs update http calendar-update-half-hourly \
  --location "${GCLOUD_REGION}" \
  --schedule "*/30 * * * *" \
  --time-zone "Europe/Stockholm" \
  --uri "https://${GCLOUD_REGION}-${GCLOUD_PROJECT}.cloudfunctions.net/calendar-export-update" \
  --http-method GET \
  --description="calendar-export-update: Update NSW GCS ics files (half-hourly)"

npm run clean