export interface BLEDevice {
  id: string;
  name?: string;
  rssi?: number;
  advertising?: {
    localName?: string;
    manufacturerData?: any;
    serviceUUIDs?: string[];
  };
}

export interface BLEService {
  uuid: string;
  characteristics: BLECharacteristic[];
}

export interface BLECharacteristic {
  uuid: string;
  properties: string[];
}

export interface BLEDeviceInfo {
  id: string;
  name?: string;
  services: BLEService[];
}

export interface DeviceData {
  cutoff_detection: boolean;
  low_battery_indication: boolean;
}

export interface ConnectedDevice {
  device_id: string;
  timestamp: string;
  data?: any;
}
