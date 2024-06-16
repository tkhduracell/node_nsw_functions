<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <ion-page>
    <ion-content>
      <form>
        <ion-card>
          <ion-card-header>
            <ion-card-title>Boka Friträning</ion-card-title>
          </ion-card-header>

          <ion-card-content>

            <b style="display: block; margin-top: 1em;">Typ av friträning</b>
            <ion-select label-placement="floating" v-model="data.mode" interface="action-sheet">
              <ion-select-option value="regular">Friträning</ion-select-option>
              <ion-select-option value="theme">Tematräning</ion-select-option>
            </ion-select>

            <div v-if="data.mode === 'theme'">
              <ion-input label="Ange tema" v-model="data.theme"
                helper-text="t.ex. Boogie Woogie, Lindy Hop, Bugg Högtempo, etc."
                label-placement="floating"></ion-input>
            </div>

            <b style="display: block; margin-top: 1em;">Ansvarig</b>
            <ion-input label="Ditt namn" v-model="data.responsible" label-placement="floating"></ion-input>
            <ion-input label="Telefonnummmer" v-model="data.tel" label-placement="floating"></ion-input>

            <b style="display: block; margin-top: 1em; margin-bottom: 0.5em;">Välj Datum / Tid</b>
            <ion-datetime :min="min" locale="sv-SE" :first-day-of-week="1" v-model="data.date" presentation="date-time"
              minuteValues="0,15,30,45" :prefer-wheel="true"
              hourValues="7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23">
              <span slot="time-label">Starttid</span>
            </ion-datetime>

            <div v-if="activities" class="activities">
              <b v-if="activities.length > 0">Andra aktiviteter denna dag<br /></b>
              <b v-else>✅ Inga andra aktiviteter denna dag</b>
              <div v-for="act in activities" class="activity" :key="act.id">
                <div class="startTime">{{ act.startTime.replace(/.*T(\d\d:\d\d).*/gi, '$1') }}</div>
                <div class="name-duration">
                  <div class="name">{{ act.name }}</div>
                  <div class="duration">{{ act.duration }} minuter</div>
                </div>
              </div>
            </div>

            <b style="display: block; margin-top: 1em;">Träningens längd</b>
            <ion-range :label="data.duration ? `${data.duration} minuter` : ''" label-placement="stacked" :ticks="true"
              :snaps="true" :step="15" :min="30" :max="120" v-model="data.duration"></ion-range>

            <b style="display: block; margin-top: 1em;">Lösenord</b>
            <ion-input label="Vårt gemensama lösenord" v-model="data.pass" type="password"
              label-placement="floating"></ion-input>

            <div style="margin-top: 1em;">
              <p>Tänk på (<a href="https://nackswinget.se/fritraning/fritraning-interna-rutiner/">Interna rutiner</a>)
              </p>
              <ul style="margin-left: -1em;">
                <li>Lämna 15 min till nästkommande kurs</li>
                <li>Lås upp nödutgången</li>
                <li>Sopa av golvet och stäng av fläktar/ljus innan du lämnar</li><!--v-if-->
              </ul>
            </div>

            <div class="errors" v-if="errors && errors.length > 0">
              Innan du kan boka måste du:
              <div class="error" v-for="e in errors" :key="e">{{ e }}</div>
            </div>
            <ion-button expand="block" style="margin-top: 1em;" @click="onSubmit"
              :disabled="errors && errors.length > 0">Boka</ion-button>
          </ion-card-content>
        </ion-card>

      </form>
    </ion-content>

  </ion-page>
</template>

<style scoped>
ion-content {
  --padding-top: 3em;
}

ion-range {
  --knob-size: 40px;
}

ion-label {
  font-size: 5em;
}

.activities {
  margin-top: 1em;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
}

.activities b {
  margin-bottom: 0.3em;
}

.activities .activity {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--nsw-red);
  border-radius: 4px;
  color: var(--ion-color-light);
  gap: 0.5em;
  padding: 0.4em;
}

.activities .activity .name-duration {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex-grow: 1;
  font-size: 90%;
}

.activities .activity .name-duration .name {
  font-weight: bold;
}

.errors {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1em;
}

.errors .error {
  color: var(--ion-color-danger);
}
</style>
<script setup lang="ts">

import { Toast } from '@capacitor/toast';
import {
  IonPage, IonContent, IonDatetime, IonInput,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonSelect, IonSelectOption, IonRange

} from '@ionic/vue';
import { useLocalStorage } from '@vueuse/core';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter()

const _mode = useLocalStorage<string>('mode', null);
const _theme = useLocalStorage<string>('theme', null);
const _pass = useLocalStorage<string>('pass', null);
const _responsible = useLocalStorage<string>('responsible', null);
const _tel = useLocalStorage<string>('tel', null);

// Return today's date as 2024-03-01T00:00:00 starting 00:00:00
const min = computed(() => {
  const today = new Date()
  const inOneHour = new Date(today.getTime() + 60 * 60 * 1000)
  today.setHours(inOneHour.getHours(), 0, 0, 0)
  return today.toISOString()
})

const data = reactive({
  mode: computed({
    get: () => _mode.value,
    set: (value) => _mode.value = value
  }),
  theme: computed({
    get: () => _theme.value,
    set: (value) => _theme.value = value
  }),
  pass: computed({
    get: () => _pass.value,
    set: (value) => _pass.value = value
  }),
  responsible: computed({
    get: () => _responsible.value,
    set: (value) => _responsible.value = value
  }),
  tel: computed({
    get: () => _tel.value,
    set: (value) => _tel.value = value
  }),
  duration: undefined as number | undefined,
  date: undefined as string | undefined
});

const errors = computed(() => {
  const errors = []
  if (!data.mode) errors.push('Välja typ av träning')
  if (!data.responsible) errors.push('Ange ansvarig')
  if (!data.tel) errors.push('Ange telefonnummer')
  if (!data.date) errors.push('Välja datum och tid')
  if (!data.duration) errors.push('Välja en längd på träningen')
  if (!data.pass) errors.push('Ange lösenord')
  return errors.map(s => " - " + s)
})

type Activity = {
  id: number;
  name: string;
  description: string;
  calendarId: number;
  startTime: string;
  endTime: string;
  duration: number;
}

const activities = ref<Activity[]>([
  //{ id: 0, name: 'Friträning', description: 'Filip - 00000', calendarId: 123, startTime: '2024-06-01T12:00:00', endTime: '', duration: 120 },
  //{ id: 0, name: 'Tematräning - Boogie Woogie', description: 'Filip - 00000', calendarId: 123, startTime: '2024-06-01T14:00:00', endTime: '', duration: 120 },
  //{ id: 0, name: 'Friträning', description: 'Filip - 00000', calendarId: 123, startTime: '2024-06-01T16:00:00', endTime: '', duration: 120 }
])

const baseUrl = 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api'
watch(() => data.date, () => {
  fetch(`${baseUrl}/book/search?date=${data.date}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        throw new Error(data.error)
      }
      activities.value = data
    })
    .catch(error => {
      console.error('Error:', error)
      activities.value = []
    })
})

function onSubmit() {
  const book = {
    title: data.mode === 'theme' ? `Tematräning - ${data.theme}` : 'Friträning',
    description: data.responsible + ' - ' + data.tel,
    location: 'Ceylon',
    date: new Date(data.date ?? '').toISOString(),
    time: data.date?.replace(/.*T(\d\d:\d\d).*/gi, '$1'),
    duration: data.duration,
    password: data.pass,
    calendarId: '337667'
  }

  fetch(`${baseUrl}/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(book)
  })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', data)
      return Toast.show({
        text: 'Träningen bokades, du skickas nu till kalendern\n\nOBS: Det kan ta upp till 1-2 minuter innan bokningen syns i kalendern', duration: 'long'
      })
    })
    .then(() => {
      router.push({ name: '/tabs/calendar' })
    })
    .catch(error => {
      Toast.show({ text: 'Något gick fel, försök igen' })
      console.error('Error:', error)
    })
}

</script>
