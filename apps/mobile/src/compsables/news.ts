import { UseAsyncStateReturn, useAsyncState } from '@vueuse/core'
import { NswApiClient } from './client'
import { inject, provide } from 'vue'

export interface News {
    title: string;
    description: string;
    link: string;
    image: string;
    category: string[];
    items: {
      id: string;
      title: string;
      description: string;
      link: string;
      author: string;
      published: number;
      created: number;
      category: string | string[];
      enclosures: {
        url: string;
        medium: string;
      }[];
      media: {
        thumbnail: {
          url: string;
          medium: string;
        };
      };
    }[];
}

export type NewsItem = News['items'][number]

export function provideNews(client: NswApiClient) {
  const params = new URLSearchParams()
  params.append('exclude', 'competitions')

  provide('news', useAsyncState(() => client.news(), null))
}


export function useNews() {
    const { isLoading: isFetching, error, state: data, execute } = inject('news') as UseAsyncStateReturn<News, any[], true>

    return { isFetching, error, data, execute }
}