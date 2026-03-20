import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface AppVersionInfo {
  latestVersionCode: number;
  latestVersionName: string;
  apkDownloadUrl: string;
  releaseNotes: string;
  isMandatory: boolean;
}

export const useAppUpdate = () => {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    if (Capacitor.getPlatform() !== 'android') {
      setIsChecking(false);
      return;
    }

    try {
      // 1. Get current device app version
      const appInfo = await App.getInfo();
      const currentVersionCode = parseInt(appInfo.build, 10);

      // 2. Fetch the latest version info from our public version.json
      // Cache buster included to ensure we get the latest file
      const response = await fetch(`https://paradigm-ifs.vercel.app/version.json?t=${new Date().getTime()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch version info');
      }
      
      const remoteInfo: AppVersionInfo = await response.json();

      // 3. Compare version codes
      if (remoteInfo.latestVersionCode > currentVersionCode) {
        setUpdateInfo(remoteInfo);
        setIsUpdateRequired(true);
      }
    } catch (error) {
      console.error('Error checking for app updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  return { updateInfo, isUpdateRequired, isChecking, checkVersion };
};
