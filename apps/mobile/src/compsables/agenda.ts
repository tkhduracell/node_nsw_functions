import { NswApiClient } from './client';
import { Ref, inject, onMounted, provide } from "vue";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Activity } from "@/compsables/client";
import { UseAsyncStateReturn, useAsyncState } from "@vueuse/core";

const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

type AgendaEvent = {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  calendarId: number;
  description: string | null;
};

type Agenda = {
  name: string;
  date: string;
  events: AgendaEvent[];
}[];

const initalState: Agenda = [];

function adapter({ date, json }: { date: string; json: Activity[] }): Agenda[number] {
  return {
    name: titleCase(format(parseISO(date), "EEEE", { locale: sv })),
    date: format(parseISO(date), "dd MMMM, yyyy", { locale: sv }),
    events: json.map((event) => ({
      id: event.id,
      name: event.name,
      startTime: format(parseISO(event.startTime), "HH:mm"),
      endTime: format(parseISO(event.endTime), "HH:mm"),
      duration: event.duration,
      calendarId: event.calendarId,
      description: event.description,
    })),
  };
}


export function provideAgenda(client: NswApiClient) {

  const { state, isReady, isLoading, error, execute } = useAsyncState(
    () => client.searchByDateRange()
      .then(dates => dates.map(adapter)),
    initalState
  )

  onMounted(execute);

  provide("agenda", { state, isReady, isLoading, error, execute });
}

export function useAgenda() {
  const { state, isReady, isLoading, error, execute } = inject(
    "agenda"
  ) as UseAsyncStateReturn<Agenda, any[], true>;

  return {
    data: state,
    isReady,
    isLoading,
    execute,
    error: error as Ref<Error | null>,
  };
}
