import { onMounted, reactive } from "vue";
import { useClient } from "./client";
import { FCM } from "@capacitor-community/fcm";
import { PushNotifications } from "@capacitor/push-notifications";

export function useSubscription() {
  const { client } = useClient();

  const data = reactive({
    isSubscribed: null as boolean | null,
    isSupported: true,
    isLoading: true,
    isDenied: false,
    error: null as any,
  });

  async function isSubscribed() {
    data.isLoading = true;

    try {
      const { receive: permission } = await PushNotifications.checkPermissions()

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
      const subscribed = await client.isSubscribed(token);
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
      const {receive: initialPermission} = await PushNotifications.checkPermissions();
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
        await PushNotifications.register();
      }

    } catch (err: any) {
      data.isSupported = false;
      data.error = err;
      console.warn("Notifications not supported", err);
      return;
    } finally {
      data.isLoading = false;
    }

    return FCM.getToken()
      .catch((err) => {
        data.isSupported = false;
        console.error("Unable to fetch FCM token", err);
        throw err;
      })
      .then(({ token }) => client.subscribe(token))
      .then(() => (data.isSubscribed = true))
      .catch((err) => (data.error = err))
      .finally(() => (data.isLoading = false));
  }

  onMounted(logPushNotificationsEvents);
  onMounted(isSubscribed);

  return { data, subscribe, unsubscribe };
}

function logPushNotificationsEvents() {
  PushNotifications.addListener('registration',
    (token) => {
      console.info('Push registration success, token:', token);
    }
  );

  PushNotifications.addListener('registrationError',
    (error: any) => {
      console.error('Error on registration:', error);
    }
  );

  // Show us the notification payload if the app is open on our device
  PushNotifications.addListener('pushNotificationReceived',
    (notification) => {
      console.info('Push received:', notification);
    }
  );

  // Method called when tapping on a notification
  PushNotifications.addListener('pushNotificationActionPerformed',
    (notification) => {
      console.info('Push action performed:', notification);
    }
  );
}
