import { useFetch } from '@vueuse/core'
import { useBaseUrl } from './client'

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

export function useNews() {
    const { baseUrl } = useBaseUrl()

    const params = new URLSearchParams()
    params.append('exclude', 'competitions')

    const { isFetching, error, data, execute } = useFetch(baseUrl + '/news-api?' + params.toString()).get().json<News>()

    return { isFetching, error, data, execute }
}