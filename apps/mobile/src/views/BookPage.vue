<!-- eslint-disable vue/no-v-text-v-html-on-component -->
<template>
  <ion-page>
    <nsw-toolbar />
    <ion-content>
      <form>
        <ion-card>
          <ion-card-header>
            <ion-card-title>Boka Friträning</ion-card-title>
          </ion-card-header>

          <ion-card-content>

            <b style="display: block; margin-top: 1em;">Typ av friträning</b>
            <ion-select label-placement="floating" label="Välj typ av träning" v-model="data.mode"
              interface="action-sheet" fill="solid">
              <ion-select-option value="regular">Friträning</ion-select-option>
              <ion-select-option value="theme">Tematräning</ion-select-option>
            </ion-select>

            <div v-if="data.mode === 'theme'">
              <ion-input label="Ange tema" v-model="data.theme"
                helper-text="t.ex. Boogie Woogie, Lindy Hop, Bugg Högtempo, etc."
                label-placement="floating"></ion-input>
            </div>

            <b style="display: block; margin-top: 1em;">Ansvarig</b>
            <ion-input label="Ditt namn" v-model="data.responsible" label-placement="floating" fill="solid"></ion-input>
            <ion-input label="Telefonnummmer" v-model="data.tel" label-placement="floating" fill="solid"></ion-input>

            <b style="display: block; margin-top: 1em; margin-bottom: 0.5em;">Välj Datum / Tid</b>

            <ion-datetime :min="min" locale="sv-SE" :first-day-of-week="1" v-model="data.datetime" presentation="date-time"
              minuteValues="0,15,30,45" :prefer-wheel="true"
              hourValues="7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23">
              <span slot="time-label">Starttid</span>
            </ion-datetime>

            <div v-if="activities" class="activities">
              <b v-if="activities.length > 0" key="header">Andra aktiviteter denna dag<br /></b>
              <b v-else key="empty-header">✅ Inga andra aktiviteter denna dag</b>

              <TransitionGroup name="list">
                <div v-for="act in activities" class="activity" :key="act.calendarId + ':' + act.id">
                  <div class="startTime">{{ act.startTime.replace(/.*T(\d\d:\d\d).*/gi, '$1') }}</div>
                  <div class="name-duration">
                    <div class="name">{{ act.name }}</div>
                    <div class="duration">{{ act.duration }} minuter</div>
                  </div>
                </div>
              </TransitionGroup>
            </div>

            <b style="display: block; margin-top: 1em;">Träningens längd</b>
            <div style="display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center;">
              <ion-button :fill="data.duration === duration ? 'solid' : 'outline'" expand="block"
                style="flex-basis: 32%;" @click="data.duration = duration"
                v-for="duration in [60, 75, 90, 60 * 2, 60 * 2 + 30, 60 * 3]" :key="'dir' + duration">
                {{ duration }} min
              </ion-button>
            </div>

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
ion-range {
  --knob-size: 40px;
}

ion-label {
  font-size: 5em;
}

ion-input {
  --background: var(--ion-color-light);
  --border-radius: 6px;

  --padding-bottom: 16px;
  --padding-end: 10px;
  --padding-start: 10px;
  --padding-top: 2px;

  margin-top: 0.4em;
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

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
</style>
<script setup lang="ts">

import { Toast } from '@capacitor/toast';
import {
  IonPage, IonContent, IonDatetime, IonInput, 
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonSelect, IonSelectOption, IonButton
} from '@ionic/vue';
import NswToolbar from '@/components/NswToolbar.vue';

import { useLocalStorage } from '@vueuse/core';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { formatInTimeZone } from 'date-fns-tz'
import { addHours, startOfTomorrow } from 'date-fns';
import { Activity } from '@/compsables/client';
import { useClient } from '@/compsables/client';
import { ActivityInit } from '@/compsables/client';
import { useAppMode } from '@/compsables/common';

const router = useRouter()
const { client } = useClient()
const { isDev } = useAppMode()

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
  duration: 120 as number | undefined,
  datetime: undefined as string | undefined
});

const errors = computed(() => {
  const errors = []
  if (!data.mode) errors.push('Välja typ av träning')
  if (!data.responsible) errors.push('Ange ansvarig')
  if (!data.tel) errors.push('Ange telefonnummer')
  if (!data.datetime) errors.push('Välja datum och tid')
  if (!data.duration) errors.push('Välja en längd på träningen')
  if (!data.pass) errors.push('Ange lösenord')
  return errors.map(s => " - " + s)
})

const date = computed(() => data.datetime && formatInTimeZone(data.datetime!, 'Europe/Stockholm', 'yyyy-MM-dd'))
const time = computed(() => data.datetime && formatInTimeZone(data.datetime!, 'Europe/Stockholm', 'HH:mm'))

const activities = ref<Activity[]>([])

watch(date, (yyyymmddd) => {
  if (!yyyymmddd) return
  client.searchByDate(yyyymmddd)
    .then(acts => {
      activities.value = acts
    })
    .catch(error => {
      console.error('Error:', error)
      activities.value = [{
        id: 0, name: str(error), description: error,
        calendarId: 123, startTime: '2024-06-01T00:00:00', endTime: '', duration: 0
      }]
    })
})

function resetDateToTomorrow() {
  let tomorrow = startOfTomorrow()
  if (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow = addHours(tomorrow, 12)
  } else {
    tomorrow = addHours(tomorrow, 19)
  }
  data.datetime = formatInTimeZone(tomorrow, 'Europe/Stockholm', 'yyyy-MM-dd\'T\'HH:mm:ss')
}

onMounted(() => resetDateToTomorrow())

function onSubmit() {
  const book: ActivityInit = {
    title: data.mode === 'theme' ? `Tematräning - ${data.theme}` : 'Friträning',
    description: data.responsible + ' - ' + data.tel,
    date: date.value!,
    time: time.value!,
    duration: data.duration!,
    password: data.pass,
    location: 'Ceylon',
    calendarId: '337667'
  }

  client.book(book)
    .then(async () => {
      if (data.responsible.toLocaleLowerCase().startsWith('test') || isDev) {
        await Toast.show({
          text: `${JSON.stringify(book, null, 2)}`,
          duration: 'long'
        })
      }
      await Toast.show({
        text: `Träningen bokades, du skickas nu till kalendern\n\nOBS: 
        Det kan ta upp till 1-2 minuter innan bokningen syns i kalendern`,
        duration: 'long'
      })
      router.push('/tabs/calendar')
    })
    .catch(error => {
      Toast.show({ text: isDev ? str(error) : 'Något gick fel, försök igen' })
      console.error('Error:', error)
    })
}

function str(x: any): string {
  if (x instanceof Error) {
    return x.message;
  } else if (typeof x === 'object') {
    if (Array.isArray(x)) {
      return `[${x.map((item: any) => str(item)).join(', ')}]`;
    } else {
      const properties = Object.entries(x).map(([key, value]) => `${key}: ${str(value)}`);
      return `{${properties.join(', ')}}`;
    }
  } else {
    return String(x);
  }
}

</script>
