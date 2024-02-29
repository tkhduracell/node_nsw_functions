import { ref } from 'vue';

export function useToast(def?: string, timeout = 5000) {
    const toasted = ref<string | null>(def ?? null)

    const timer = ref<NodeJS.Timeout | null>(null)

    function toast(id: string) {
        if (timer.value) clearTimeout(timer.value);

        toasted.value = id;
        timer.value = setTimeout(() => {
            if (toasted.value !== id) return;
            toasted.value = null;
        }, timeout)
    }

    return { toast, toasted }
}