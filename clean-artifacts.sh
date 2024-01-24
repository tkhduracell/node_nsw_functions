#!/bin/bash

# Set your Google Cloud Artifact Registry details
PROJECT_ID="nackswinget-af7ef"
REPOSITORY="gcf-artifacts"
LOCATION="europe-north1-docker.pkg.dev"
IMAGES=("notifications--api" "competitions--api" "calendars--update--api" "calendars--api")

for IMAGE in "${IMAGES[@]}"; do
    echo "Processing $IMAGE..."

    # List the artifacts
    artifacts=$(
        gcloud artifacts docker images list "${LOCATION}/${PROJECT_ID}/${REPOSITORY}/${IMAGE}" --format json|\
        jq "sort_by(.createTime)|reverse"|\
        jq -r '.[].version'
    )
    artifact_count=$(echo "$artifacts" |wc -l |jq -r)
    echo "Found $artifact_count artifacts for $IMAGE."

    if [ "$artifact_count" -ge 4 ]; then
        artifacts=$(echo "${artifacts}"| tail -n +4)
        for artifact in $artifacts; do
            echo "Deleting artifact: $artifact"
            gcloud artifacts docker images delete --async --quiet "${LOCATION}/${PROJECT_ID}/${REPOSITORY}/${IMAGE}@${artifact}"
        done
        echo "Cleanup of ${IMAGE} completed."
    else
        echo "Not enough artifacts to delete for $IMAGE."
    fi

    echo ""
    echo ""
done

echo "All cleanup completed."
