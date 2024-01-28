import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.nackswinget.apps',
  appName: 'mobile',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
