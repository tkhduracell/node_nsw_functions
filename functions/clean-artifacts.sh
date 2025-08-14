#!/bin/bash

# Set your Google Cloud Artifact Registry details
PROJECT_ID="nackswinget-af7ef"
REPOSITORY="gcf-artifacts"
LOCATION="europe-north1-docker.pkg.dev"
IMAGES=("notifications--api" "competitions--api" "calendars--update--api" "calendars--api" "news--api")
PROJECT_PREFIX="nackswinget--af7ef__europe--north1"

# Color and formatting constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Unicode symbols
ROCKET="🚀"
TRASH="🗑️"
CHECK="✅"
WARNING="⚠️"
INFO="ℹ️"
CLOCK="⏰"
PACKAGE="📦"
SPARKLES="✨"

# Function to print colored messages
print_header() {
    echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_info() {
    echo -e "${INFO} ${BLUE}$1${NC}"
}

print_success() {
    echo -e "${CHECK} ${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${WARNING} ${YELLOW}$1${NC}"
}

print_error() {
    echo -e "❌ ${RED}$1${NC}"
}

print_action() {
    echo -e "${TRASH} ${MAGENTA}$1${NC}"
}

print_progress() {
    echo -e "${CLOCK} ${DIM}$1${NC}"
}

# Start cleanup process
print_header "${ROCKET} Google Cloud Artifact Registry Cleanup ${SPARKLES}"
print_info "Project: ${BOLD}${PROJECT_ID}${NC}"
print_info "Repository: ${BOLD}${REPOSITORY}${NC}"
print_info "Location: ${BOLD}${LOCATION}${NC}"
print_info "Total images to process: ${BOLD}${#IMAGES[@]}${NC}"

total_artifacts_deleted=0
total_images_processed=0
start_time=$(date +%s)

for IMAGE in "${IMAGES[@]}"; do
    ((total_images_processed++))
    
    echo -e "\n${BOLD}${MAGENTA}[$total_images_processed/${#IMAGES[@]}]${NC} ${PACKAGE} Processing ${BOLD}${IMAGE}${NC}..."

    fullname="${LOCATION}/${PROJECT_ID}/${REPOSITORY}/${PROJECT_PREFIX}__${IMAGE}"

    print_progress "Fetching artifact list..."
    # List the artifacts
    artifacts=$(
        gcloud artifacts docker images list "${fullname}" --format json|\
        jq "sort_by(.createTime)|reverse"|\
        jq -r '.[].version'
    )
    artifact_count=$(echo "$artifacts" |wc -l |jq -r)
    
    if [ "$artifact_count" -gt 0 ]; then
        print_info "Found ${BOLD}${artifact_count}${NC} artifacts for ${BOLD}${IMAGE}${NC}"
    else
        print_warning "No artifacts found for ${BOLD}${IMAGE}${NC}"
        continue
    fi

    if [ "$artifact_count" -ge 4 ]; then
        artifacts_to_delete=$(echo "${artifacts}"| tail -n +4)
        artifacts_to_delete_count=$(echo "$artifacts_to_delete" | wc -l)
        
        print_info "Keeping latest 3 artifacts, deleting ${BOLD}${artifacts_to_delete_count}${NC} older ones..."
        
        count=0
        for artifact in $artifacts_to_delete; do
            ((count++))
            ((total_artifacts_deleted++))
            print_action "[$count/$artifacts_to_delete_count] Deleting artifact: ${DIM}${artifact}${NC}"
            gcloud artifacts docker images delete --async --quiet "${fullname}@${artifact}"
        done
        print_success "Cleanup of ${BOLD}${IMAGE}${NC} completed! Deleted ${BOLD}${artifacts_to_delete_count}${NC} artifacts"
    else
        print_warning "Only ${BOLD}${artifact_count}${NC} artifacts found for ${BOLD}${IMAGE}${NC} - keeping all (minimum 4 required for cleanup)"
    fi
done

end_time=$(date +%s)
duration=$((end_time - start_time))

# Final summary
print_header "${SPARKLES} Cleanup Summary ${SPARKLES}"
print_success "Images processed: ${BOLD}${total_images_processed}${NC}"
print_success "Total artifacts deleted: ${BOLD}${total_artifacts_deleted}${NC}"
print_success "Duration: ${BOLD}${duration}s${NC}"
print_success "All cleanup completed! ${CHECK}"

echo -e "\n${BOLD}${GREEN}${SPARKLES} Happy coding! ${SPARKLES}${NC}\n"
