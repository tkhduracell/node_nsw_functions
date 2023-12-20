import z from 'zod'

export const GCloudOptions = z.object({
    GCLOUD_PROJECT: z.string().min(1),
    GCLOUD_BUCKET: z.string().min(1)
})

export const IDOActivityOptions = z.object({
    ACTIVITY_ORG_ID: z.string().min(1),
    ACTIVITY_BASE_URL: z.string().url(),
    ACTIVITY_USERNAME: z.string().min(1),
    ACTIVITY_PASSWORD: z.string().min(1)
})
