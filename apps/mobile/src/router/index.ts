import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue'
import CalendarPage from '../views/CalendarPage.vue'
import NewsPage from '../views/NewsPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/calendar'
  },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/calendar'
      },
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
        component: NewsPage
      },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
