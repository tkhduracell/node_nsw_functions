#!/bin/bash

# Read env file
# shellcheck disable=SC2046
export $(grep -v '^#' .env | xargs)

gsutil cors set functions/cors.json gs://${GCLOUD_PROJECT}.appspot.com