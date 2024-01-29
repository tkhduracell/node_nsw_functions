import { onMounted, reactive } from "vue";
import { useClient } from "./client";
import { FCM } from "@capacitor-community/fcm";
import { PushNotifications } from "@capacitor/push-notifications";

export function useSubscription() {
  const { client } = useClient();

  const data = reactive({
    isSubscribed: null as boolean | null,
    isSupported: false,
    isLoading: true,
    error: null as any,
  });

  async function isSubscribed() {
    data.isLoading = true;
    FCM.getToken()
      .then(({ token }) => {
        data.isSupported = true;
        return token;
      })
      .catch((err) => {
        console.warn("Failed to fetch token", err);
        data.isSupported = false;
        throw err;
      })
      .then((token) => {
        return client
          .isSubscribed(token)
          .then((subscribed) => (data.isSubscribed = subscribed))
          .catch((err) => {
            data.error = err;
            data.isSubscribed = false;
            console.error("Failed to fetch notification status", err);
          });
      })
      .finally(() => (data.isLoading = false));
  }

  async function unsubscribe() {
    const { token } = await FCM.getToken();
    data.isLoading = true;
    return client
      .unsubscribe(token)
      .then(() => (data.isSubscribed = false))
      .catch((err) => {
        data.error = err;
        console.error("Failed to unsubscribe", err);
        isSubscribed();
      })
      .finally(() => (data.isLoading = false));
  }

  async function subscribe() {
    data.isLoading = true;
    try {
      const permisson = await PushNotifications.requestPermissions();
      if (permisson.receive !== "granted") {
        console.error("Notification permission not granted", { permisson });
        data.error = "Notification permission not granted";
        return;
      }
      await PushNotifications.register();
    } catch (err: any) {
      data.isSupported = false;
      data.error = err;
      console.error("Notification not supported", err);
      return;
    }

    return FCM.getToken()
      .then(({ token }) => client.subscribe(token))
      .then(() => (data.isSubscribed = true))
      .catch((err) => (data.error = err))
      .finally(() => (data.isLoading = false));
  }

  onMounted(isSubscribed);

  return { data, subscribe, unsubscribe };
}
