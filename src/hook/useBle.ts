import { useState, useEffect, useCallback } from 'react';
import BleManager from 'react-native-ble-manager';
import { NativeEventEmitter, NativeModules, EmitterSubscription } from 'react-native';
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
  writeData: (serviceUUID: string, characteristicUUID: string, data: number[]) => Promise<void>;
  readData: (serviceUUID: string, characteristicUUID: string) => Promise<number[]>;
}

export const useBLE = (): UseBLEReturn => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BLEDevice | null>(null);

  useEffect(() => {
    BleManager.start({ showAlert: false });

    const handleDiscoverPeripheral = (peripheral: BLEDevice) => {
      if (peripheral.name) {
        setDevices(prev => {
          const exists = prev.find(d => d.id === peripheral.id);
          if (!exists) {
            return [...prev, peripheral];
          }
          return prev;
        });
      }
    };

    const handleStopScan = () => {
      setIsScanning(false);
    };

    const handleDisconnect = (data: { peripheral: string }) => {
      console.log('Disconnected from:', data.peripheral);
      setConnectedDevice(null);
    };

    const subscriptions: EmitterSubscription[] = [
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnect),
    ];

    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  const startScan = useCallback(async (): Promise<void> => {
    setDevices([]);
    setIsScanning(true);
    
    try {
      await BleManager.scan([], 10, false);
    } catch (error) {
      setIsScanning(false);
      throw new Error(`Scan failed: ${error}`);
    }
  }, []);

  const stopScan = useCallback(async (): Promise<void> => {
    try {
      await BleManager.stopScan();
      setIsScanning(false);
    } catch (error) {
      console.error('Stop scan error:', error);
    }
  }, []);

  const connectToDevice = useCallback(async (device: BLEDevice): Promise<void> => {
    try {
      await BleManager.connect(device.id);
      setConnectedDevice(device);
      
      // Retrieve services after connection
      const deviceInfo: BLEDeviceInfo = await BleManager.retrieveServices(device.id);
      console.log('Device services:', deviceInfo);
      
    } catch (error) {
      setConnectedDevice(null);
      throw new Error(`Failed to connect: ${error}`);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!connectedDevice) return;
    
    try {
      await BleManager.disconnect(connectedDevice.id);
      setConnectedDevice(null);
    } catch (error) {
      throw new Error(`Disconnect failed: ${error}`);
    }
  }, [connectedDevice]);

  const writeData = useCallback(async (
    serviceUUID: string, 
    characteristicUUID: string, 
    data: number[]
  ): Promise<void> => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }
    
    try {
      await BleManager.write(
        connectedDevice.id,
        serviceUUID,
        characteristicUUID,
        data
      );
    } catch (error) {
      throw new Error(`Write failed: ${error}`);
    }
  }, [connectedDevice]);

  const readData = useCallback(async (
    serviceUUID: string, 
    characteristicUUID: string
  ): Promise<number[]> => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }
    
    try {
      const data = await BleManager.read(
        connectedDevice.id,
        serviceUUID,
        characteristicUUID
      );
      return data;
    } catch (error) {
      throw new Error(`Read failed: ${error}`);
    }
  }, [connectedDevice]);

  return {
    isScanning,
    devices,
    connectedDevice,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    writeData,
    readData,
  };
};