import { Platform, PermissionsAndroid } from 'react-native';

export const requestBLEPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') return true;

  const version = Number(Platform.Version);
  const permissions =
    version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, 
        ];

  try {
    const results = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(results).every(result => result === 'granted');
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};
