import { onMounted, onUnmounted, reactive } from "vue";
import { useClient } from "./client";
import { FCM } from "@capacitor-community/fcm";
import { PushNotifications } from "@capacitor/push-notifications";

type State = {
  isSubscribed: boolean | null;
  isSupported: boolean;
  isLoading: boolean;
  isDenied: boolean;
  error: any;
};

export function useSubscription(topic: string) {
  const { client } = useClient();

  const data = reactive<State>({
    isSubscribed: null,
    isSupported: true,
    isLoading: true,
    isDenied: false,
    error: null,
  });

  async function isSubscribed() {
    data.isLoading = true;

    try {
      const { receive: permission } = await PushNotifications.checkPermissions().catch((err) => {
        data.isSupported = false
        return err
      })

      if (permission === 'denied') {
        console.warn("Notification permission not granted", { permission });
        data.isDenied = true;
        return;
      }

      // If denided, we can't check subscription status
      if (permission !== 'granted') {
        console.info("Notification permission not granted, stopping...", { permission });
        return;
      }

      data.isDenied = false;

      const { token } = await FCM.getToken();
      const subscribed = await client.isSubscribed(token, topic);
      console.info("Subscription status", { subscribed });
      data.isSubscribed = subscribed
    } catch (err: any) {
      data.error = err;
      data.isSubscribed = false;
      console.error("Failed to fetch notification status", err);
    } finally {
      data.isLoading = false
    }
  }

  async function unsubscribe() {
    const { token } = await FCM.getToken();
    data.isLoading = true;
    return client
      .unsubscribe(token, topic)
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
      const {receive: initialPermission} = await PushNotifications.checkPermissions()
      data.isSupported = true;

      if (initialPermission === 'denied') {
        console.error("Notification permission not granted from start", { initialPermission });
        data.isDenied = true;
        return;
      }

      if (initialPermission !== 'granted') {
        const { receive: permission } = await PushNotifications.requestPermissions();
        if (permission === "denied") {
          console.error("Notification permission not granted after request", { permission });
          data.isDenied = true;
          return;
        }
        data.isDenied = false;

        // Wait for the registration to be available
        await new Promise((resolve) => setTimeout(resolve, 500));

        await PushNotifications.register();

        // Wait for the token to be available
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

    } catch (err: any) {
      data.isSupported = false;
      data.error = err;
      console.warn("Notifications not supported", err);
      return;
    }

    return FCM.getToken()
      .catch((err) => {
        data.isSupported = false;
        console.error("Unable to fetch FCM token", err);
        throw err;
      })
      .then(({ token }) => client.subscribe(token, topic))
      .then(() => (data.isSubscribed = true))
      .catch((err) => (data.error = err))
      .finally(() => (data.isLoading = false));
  }

  function registerListerners() {
    PushNotifications.addListener('registration', (token) => {
      console.info('Push registration success, token:', token);
    }).catch(() => console.warn("Failed to register registration listener"));

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration:', error);
      data.error = error;
    }).catch(() => console.warn("Failed to register registrationError listener"));
  }

  onMounted(registerListerners);
  onMounted(isSubscribed);
  onUnmounted(() => {
    console.info("PushNotifications: Removing listeners");
    PushNotifications.removeAllListeners();
  })

  return { data, subscribe, unsubscribe };
}