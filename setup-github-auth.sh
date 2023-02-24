#!/bin/bash
#
# export PROJECT_ID="my-project" # update with your value
# 

GCLOUD_SERVICE_ACCOUNT=github-deployer-account
GCLOUD_SERVICE_ACCOUNT_EMAIL="${GCLOUD_SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
GCLOUD_IDENTITY_POOL=github-deployer-auth-pool
GCLOUD_IDENTITY_PROVIDER=github-deployer-auth-provider

GITHUB_REPO=tkhduracell/node_nsw_functions

gcloud iam service-accounts create ${GCLOUD_SERVICE_ACCOUNT} --project "${PROJECT_ID}"
gcloud services enable iamcredentials.googleapis.com --project "${PROJECT_ID}"

gcloud iam workload-identity-pools create ${GCLOUD_IDENTITY_POOL} --project="${PROJECT_ID}" --location="global" --display-name="GitHub Deploy Auth Pool"

WORKLOAD_IDENTITY_POOL_ID=$(gcloud iam workload-identity-pools describe ${GCLOUD_IDENTITY_POOL} --project="${PROJECT_ID}" --location="global" --format="value(name)")

gcloud iam workload-identity-pools providers create-oidc ${GCLOUD_IDENTITY_PROVIDER} \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${GCLOUD_IDENTITY_POOL}" \
  --display-name="GitHub Deploy Auth Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts add-iam-policy-binding "${GCLOUD_SERVICE_ACCOUNT_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/${GITHUB_REPO}"

WORKLOAD_IDENTITY_PROVIDER_ID=$(gcloud iam workload-identity-pools providers list --project="${PROJECT_ID}" --location="global" --workload-identity-pool="${WORKLOAD_IDENTITY_POOL_ID}" --format="value(name)")

echo "WORKLOAD_IDENTITY_PROVIDER_ID: "
echo "${WORKLOAD_IDENTITY_PROVIDER_ID}"

echo "GCLOUD_SERVICE_ACCOUNT_EMAIL: "
echo "${GCLOUD_SERVICE_ACCOUNT_EMAIL}"

