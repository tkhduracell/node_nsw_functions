# Android application


## Building

    ./gradlew --no-daemon bundleRelease
    open app/build/outputs/bundle/release/app-release.aab

## Secrets

    gcloud --project=nackswinget-... secrets versions access latest --secret="GOOGLE_PLAY_KEYSTORE" --out-file=/tmp/google_play_keystore
