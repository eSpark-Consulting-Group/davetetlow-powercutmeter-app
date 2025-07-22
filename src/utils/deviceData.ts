import api from '../api';
import { ConnectedDevice } from '../types/ble';

const getDeviceData = async (): Promise<{ status: boolean; deviceData?: ConnectedDevice[]; message?: string }> => {
  try {
    const {data}  = await api.get<ConnectedDevice[]>('device-data');
    console.log("Device Data "+JSON.stringify(data))
    if (data && Array.isArray(data)) {
      return {
        status: true,
        deviceData: data as ConnectedDevice[] | [],
      };
    }
    return { status: false, message: 'Invalid response format.' };
  } catch (error) {
    return { status: false, message: 'An error occurred.' };
  }
};

export { getDeviceData };