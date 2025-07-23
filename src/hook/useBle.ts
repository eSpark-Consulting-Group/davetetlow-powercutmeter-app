import { useState, useEffect, useCallback } from 'react';
import BleManager from 'react-native-ble-manager';
import {
  NativeEventEmitter,
  NativeModules,
  EmitterSubscription,
} from 'react-native';
import { requestBLEPermissions } from '../utils/blePermission';
import { BLEDevice, BLEDeviceInfo } from '../types/ble';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

interface UseBLEReturn {
  isScanning: boolean;
  devices: BLEDevice[];
  connectedDevice: BLEDevice | null;
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectToDevice: (device: BLEDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  writeData: (
    serviceUUID: string,
    characteristicUUID: string,
    data: number[],
  ) => Promise<void>;
  getDiscoveredDevices: () => Promise<BLEDevice[]>;
}

export const useBLE = (): UseBLEReturn => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(
    null,
  );

  useEffect(() => {
    const initializeBLE = async () => {
      try {
        // Request permissions first
        const permissionsGranted = await requestBLEPermissions();
        if (!permissionsGranted) {
          console.error('BLE permissions not granted');
          return;
        }

        // Initialize BLE Manager
        await BleManager.start({ showAlert: false });
        console.log('BLE Manager initialized');
      } catch (error) {
        console.error('BLE initialization failed:', error);
      }
    };

    initializeBLE();

    const handleDiscoverPeripheral = (peripheral: BLEDevice) => {
      console.log('Discovered peripheral:', peripheral);

      // Accept devices even without names (you can filter later if needed)
      setDevices(prev => {
        const exists = prev.find(d => d.id === peripheral.id);
        if (!exists) {
          return [...prev, peripheral];
        } else {
          // Update existing device (in case RSSI or other properties changed)
          return prev.map(d => (d.id === peripheral.id ? peripheral : d));
        }
      });
    };

    const handleStopScan = () => {
      console.log('Scan stopped');
      setIsScanning(false);
    };

    const handleDisconnect = (data: { peripheral: string }) => {
      console.log('Disconnected from:', data.peripheral);
      setConnectedDevice(null);
    };

    const subscriptions: EmitterSubscription[] = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnect,
      ),
    ];

    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  const startScan = useCallback(async (): Promise<void> => {
    try {
      const permissionsGranted = await requestBLEPermissions();
      if (!permissionsGranted) {
        throw new Error('BLE permissions not granted');
      }

      const currentlyScanning = await BleManager.isScanning();
      if (currentlyScanning) {
        await BleManager.stopScan();
      }

      setDevices([]);
      setIsScanning(true);

      console.log('Starting BLE scan...');
      await BleManager.scan([], 10, false);
    } catch (error) {
      console.error('Scan failed:', error);
      setIsScanning(false);
      throw new Error(`Scan failed: ${error}`);
    }
  }, []);

  const stopScan = useCallback(async (): Promise<void> => {
    try {
      await BleManager.stopScan();
      setIsScanning(false);
      console.log('Scan stopped manually');
    } catch (error) {
      console.error('Stop scan error:', error);
    }
  }, []);

  const getDiscoveredDevices = useCallback(async (): Promise<BLEDevice[]> => {
    try {
      const discoveredDevices = await BleManager.getDiscoveredPeripherals();
      console.log('Discovered devices from cache:', discoveredDevices);

      setDevices(prevDevices => {
        const mergedDevices = [...prevDevices];

        discoveredDevices.forEach(cacheDevice => {
          const exists = mergedDevices.find(d => d.id === cacheDevice.id);
          if (!exists) {
            mergedDevices.push(cacheDevice);
          }
        });

        return mergedDevices;
      });

      return discoveredDevices;
    } catch (error) {
      console.error('Failed to get discovered devices:', error);
      return [];
    }
  }, []);

const connectToDevice = useCallback((device: BLEDevice): Promise<void> => {
  console.log('Connecting to device:', device.id);

  return BleManager.connect(device.id)
    .then(() => {
      console.log('Connected:', device.id);
      setConnectedDevice(device);

      return BleManager.requestMTU(device.id, 182);
    })
    .then((mtu) => {
      console.log(`MTU size set to: ${mtu}`);
      return BleManager.retrieveServices(device.id);
    })
    .then(async (deviceInfo) => {
      console.log('Device services:', deviceInfo);
      await delay(500);
    })
    .catch((error) => {
      console.error('Connection failed:', error);
      setConnectedDevice(null);
      throw new Error(`Failed to connect: ${String(error)}`);
    });
}, []);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const disconnect = useCallback(async (): Promise<void> => {
    if (!connectedDevice) return;

    try {
      await BleManager.disconnect(connectedDevice.id);
      setConnectedDevice(null);
      console.log('Disconnected successfully');
    } catch (error) {
      console.error('Disconnect failed:', error);
      throw new Error(`Disconnect failed: ${error}`);
    }
  }, [connectedDevice]);

  const writeData = useCallback(
    async (
      serviceUUID: string,
      characteristicUUID: string,
      data: number[],
    ): Promise<void> => {
      if (!connectedDevice) {
        throw new Error('No device connected');
      }
      const MAX_BYTE_SIZE = 179;
      return BleManager.write(
        connectedDevice.id,
        serviceUUID,
        characteristicUUID,
        data,
        MAX_BYTE_SIZE
      )
        .then(() => {
          console.log('Write successful:', data);
        })
        .catch(error => {
          throw new Error(`Write failed: ${String(error)}`);
        });
    },
    [connectedDevice],
  );

  return {
    isScanning,
    devices,
    connectedDevice,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    writeData,
    getDiscoveredDevices,
  };
};
