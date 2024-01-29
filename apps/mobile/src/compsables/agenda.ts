import { onMounted, reactive } from "vue";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Activity, useClient } from "@/compsables/client";

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
const _agenda: {
  name: string;
  date: string;
  events: AgendaEvent[];
}[] = [];

function adapter({ date, json }: { date: string; json: Activity[] }) {
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

export function useAgenda() {
  const { client } = useClient();
  const data = reactive({
    items: _agenda,
    isLoading: true,
    error: null as any,
  });

  async function load() {
    data.error = null;
    data.isLoading = true;
    const dates = client.searchByDateRange(new Date(), 14);

    const results = await dates
      .catch((err: any) => {
        console.error("Failed to fetch calendar", err);
        data.error = err;
        return [];
      })
      .finally(() => (data.isLoading = false));

    data.items = results.map(adapter);
  }

  onMounted(load);

  return {
    data,
    load,
  };
}
