<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <ion-page>
    <iframe src="https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book" class="w-100 h-100"
      :onLoad="onLoaded" ref="iframe" :style="{ paddingTop: isIOS ? '3em' : '0' }" />
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
  IonPage, isPlatform
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Toast } from '@capacitor/toast';

const initallyLoaded = ref(false);
const iframe = ref<HTMLIFrameElement | null>(null);
const isIOS = isPlatform('ios');
const isDesktop = isPlatform('desktop');
const router = useRouter();

async function onLoaded() {
  if (initallyLoaded.value) {
    if (isDesktop) {
      console.log('Bokningen slutfördes.', { initallyLoaded: initallyLoaded.value });
    } else {
      Toast.show({
        text: 'Bokningen slutfördes. Det tar några minuter innan den syns i kalendern.',
        duration: 'long'
      });
    }
    await router.push('/tabs/calendar')
      .finally(() => {
        const element = iframe.value;
        initallyLoaded.value = false
        if (element) {
          const url = "https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book?t=" + new Date().getTime()
          console.log('Reloading iframe', { url });
          element.src = url;
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
