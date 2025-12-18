import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.globalappliance.technician',
  appName: 'Global Appliance Tech',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
