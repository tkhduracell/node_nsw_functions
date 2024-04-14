<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <ion-page>
    <iframe src="https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book" class="w-100 h-100"
      :onLoad="onLoaded" ref="iframe" />
  </ion-page>
</template>

<style scoped>
.h-100 {
  height: 100%;
}

.w-100 {
  width: 100%;
}
</style>
<script setup lang="ts">

import {
  IonPage
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Toast } from '@capacitor/toast';

const initallyLoaded = ref(false);
const iframe = ref<HTMLIFrameElement | null>(null);

const router = useRouter();

async function onLoaded() {
  if (initallyLoaded.value) {
    await Toast.show({
      text: 'Bokningen slutfördes. Det tar några minutier innan den syns i kalendern.',
      duration: 'long'
    });
    await router.push('/tabs/calendar')
      .finally(() => {
        const element = iframe.value;
        initallyLoaded.value = false
        if (element) {
          element.src = "https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book?t=" + new Date().getTime();
          setTimeout(() => initallyLoaded.value = false, 1000)
        }
      });
  }

  initallyLoaded.value = true;
}
onMounted(() => {
  initallyLoaded.value = false;
});
</script>
