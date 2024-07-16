import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import Tabs from '../views/Tabs.vue'
import CalendarPage from '../views/CalendarPage.vue'

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tabs/calendar' },
  {
    path: '/tabs/',
    component: Tabs,
    children: [
      { path: '', redirect: '/tabs/calendar' },
      {
        path: 'calendar',
        name: 'Calendar',
        component: CalendarPage
      },
      {
        path: 'book',
        name: 'Book',
        component: () => import('@/views/BookPage.vue')
      },
      {
        path: 'news',
        name: 'News',
        component: () => import('@/views/NewsPage.vue')
      },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
