import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  TextInput,
  Keyboard,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import WifiManager from 'react-native-wifi-reborn';

// Type definitions
interface DeviceData {
  device_id: string;
  cutoff_detection: boolean;
  low_battery_indication: boolean;
  timestamp?: string;
}

interface ConnectedDevice {
  id: string;
  name: string;
  data: DeviceData;
}

interface MockDevice {
  id: string;
  name: string;
  rssi: number;
}

type ScreenType =
  | 'scanning'
  | 'deviceList'
  | 'wifiModal'
  | 'connecting'
  | 'success'
  | 'dashboard';

const App: React.FC = () => {
  const { height, width } = Dimensions.get('window');
  const [showPassword, setShowPassword] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('scanning');
  const [bleManager] = useState<BleManager>(new BleManager());
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [mockDevices, setMockDevices] = useState<MockDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<
    Device | MockDevice | null
  >(null);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>(
    [],
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [wifiSSID, setWifiSSID] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);

  // Animated border for scanning
  const borderAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.timing(borderAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
      ).start();
    } else {
      borderAnim.stopAnimation();
      borderAnim.setValue(0);
    }
  }, [isScanning, borderAnim]);

  // Interpolate border color
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#d1d5db', '#008EFB', '#d1d5db'],
  });

  // Static mock data for testing (comment out when using real devices)
  const MOCK_DEVICES: MockDevice[] = [
    { id: '1', name: 'Device ID_ESP_34:CD:B0:85:8C:AC', rssi: -45 },
    { id: '2', name: 'Device ID_ESP_34:CD:B0:85:8C:AD', rssi: -52 },
    { id: '3', name: 'Device ID_ESP_34:CD:B0:85:8C:AE', rssi: -38 },
    { id: '4', name: 'Device ID_ESP_34:CD:B0:85:8C:AF', rssi: -61 },
    { id: '5', name: 'Device ID_ESP_34:CD:B0:85:8C:B0', rssi: -47 },
  ];

  useEffect(() => {
    requestPermissions();
    return () => {
      bleManager.destroy();
    };
  }, [bleManager]);

  // Mock dashboard data --- IGNORE ---
  // This effect simulates connected devices for the dashboard screen
  useEffect(() => {
    if (currentScreen === 'dashboard') {
      const interval = setInterval(() => {
        const mockConnectedDevices: ConnectedDevice[] = [
          {
            id: '265624',
            name: 'ESP32_Device_1',
            data: {
              device_id: 'ESP_34:CD:B0:85:8C:AC',
              cutoff_detection: false,
              low_battery_indication: true,
              timestamp: new Date().toLocaleTimeString(),
            },
          },
          {
            id: '265625',
            name: 'ESP32_Device_2',
            data: {
              device_id: 'ESP_34:CD:B0:85:8C:AD',
              cutoff_detection: true,
              low_battery_indication: true,
              timestamp: new Date().toLocaleTimeString(),
            },
          },
          {
            id: '265626',
            name: 'ESP32_Device_3',
            data: {
              device_id: 'ESP_34:CD:B0:85:8C:AE',
              cutoff_detection: false,
              low_battery_indication: false,
              timestamp: new Date().toLocaleTimeString(),
            },
          },
          {
            id: '265627',
            name: 'ESP32_Device_4',
            data: {
              device_id: 'ESP_34:CD:B0:85:8C:AF',
              cutoff_detection: Math.random() > 0.5,
              low_battery_indication: Math.random() > 0.5,
              timestamp: new Date().toLocaleTimeString(),
            },
          },
        ];
        setConnectedDevices(mockConnectedDevices);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [currentScreen]);

  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      try {
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log('Permissions granted:', granted);
      } catch (error) {
        console.log('Permission request error:', error);
      }
    }
  };

  const startScanning = async (): Promise<void> => {
    setIsScanning(true);
    setScannedDevices([]);
    setMockDevices([]);

    // STATIC DATA FOR TESTING - Comment out when using real devices
    setTimeout(() => {
      setMockDevices(MOCK_DEVICES);
      setIsScanning(false);
      setCurrentScreen('deviceList');
    }, 3000);

    /* REAL DEVICE SCANNING - Uncomment when using real devices
    try {
      const state: State = await bleManager.state();
      if (state !== 'PoweredOn') {
        Alert.alert('Bluetooth', 'Please enable Bluetooth');
        setIsScanning(false);
        return;
      }

      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('Scan error:', error);
          setIsScanning(false);
          return;
        }

        if (device && device.name && device.name.includes('ESP32')) {
          setScannedDevices(prevDevices => {
            const exists = prevDevices.find(d => d.id === device.id);
            if (!exists) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      });

      setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsScanning(false);
        setCurrentScreen('deviceList');
      }, 10000);
    } catch (error) {
      console.log('Scan error:', error);
      setIsScanning(false);
    }
    */
  };

  const selectDevice = (device: Device | MockDevice): void => {
    console.log('Selected device:', device);
    setSelectedDevice(device);
    setShowWifiModal(true);
  };

  const connectToDevice = async (): Promise<void> => {
    if (!selectedDevice || !wifiSSID || !wifiPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setShowWifiModal(false);
    setCurrentScreen('connecting');

    // STATIC CONNECTION FOR TESTING
    setTimeout(() => {
      setCurrentScreen('success');
      setTimeout(() => {
        setCurrentScreen('dashboard');
      }, 2000);
    }, 3000);

    /* REAL DEVICE CONNECTION - Uncomment when using real devices
    try {
      if ('connect' in selectedDevice) {
        const connectedDevice = await selectedDevice.connect();
        await connectedDevice.discoverAllServicesAndCharacteristics();
        await configureWiFi(connectedDevice);
      }
      
      setCurrentScreen('success');
      setTimeout(() => {
        setCurrentScreen('dashboard');
      }, 2000);
      
    } catch (error) {
      console.log('Connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to device');
      setCurrentScreen('deviceList');
    }
    */
  };

  const configureWiFi = async (device: Device): Promise<void> => {
    try {
      // Send WiFi credentials to ESP32 device
      console.log('Configuring WiFi with SSID:', wifiSSID);
    } catch (error) {
      console.log('WiFi configuration error:', error);
    }
  };

  const StatusBar: React.FC = () => (
    <View style={styles.statusBar}>
      <Text style={styles.time}>9:41</Text>
      <View style={styles.statusIcons}>
        <View style={styles.signalBars}>
          <View style={[styles.bar, styles.barActive]} />
          <View style={[styles.bar, styles.barActive]} />
          <View style={[styles.bar, styles.barActive]} />
          <View style={[styles.bar, styles.barActive]} />
        </View>
        <Text style={styles.wifiIcon}>📶</Text>
        <View style={styles.batteryIcon}>
          <View style={styles.batteryBody} />
          <View style={styles.batteryTip} />
        </View>
      </View>
    </View>
  );

  const StatusPill: React.FC<{ status: boolean }> = ({ status }) => (
    <View
      style={[
        styles.statusPill,
        status ? styles.statusPillTrue : styles.statusPillFalse,
      ]}
    >
      <Text style={styles.statusPillText}>{status ? 'True' : 'False'}</Text>
    </View>
  );

  const DeviceCard: React.FC<{ device: ConnectedDevice }> = ({ device }) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceIdBadge}>
        <Text style={styles.deviceIdText}>Device ID_{device.id}</Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Power Cut-off</Text>
        <StatusPill status={device.data.cutoff_detection} />
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Battery Low</Text>
        <StatusPill status={device.data.low_battery_indication} />
      </View>
    </View>
  );

  // Main render logic
  let screenContent;
  if (currentScreen === 'scanning') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Add Device</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={startScanning}
            disabled={isScanning}
          >
            <Text style={styles.primaryButtonText}>
              {isScanning ? 'Scanning Nearby Device' : 'Scanning Nearby Device'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scanningCircle}>
          <Animated.View
            style={[
              styles.circularProgress,
              { borderColor: isScanning ? borderColor : '#d1d5db' },
            ]}
          >
            <View style={styles.deviceIcon}>
              <Image
                source={require('./src/assets/scanningWifi.png')}
                style={{ width: width * 0.5, height: width * 0.5 }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  } else if (currentScreen === 'deviceList') {
    const devicesToShow = mockDevices.length > 0 ? mockDevices : scannedDevices;
    screenContent = (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Add Device</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>Available Device</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.deviceList}>
          {devicesToShow.map(device => (
            <TouchableOpacity
              key={device.id}
              style={styles.availableDeviceItem}
              onPress={() => selectDevice(device)}
            >
              <View style={styles.deviceIcon}>
                <Image
                  source={require('./src/assets/device.png')}
                  style={{ width: 25, height: 25, marginRight: 10 }}
                />
              </View>
              <Text style={styles.availableDeviceName}>
                {'name' in device ? device.name : `Device ID_${device?.id}`}
              </Text>
              <View style={styles.deviceIcon}>
                <Image
                  source={require('./src/assets/lock.png')}
                  style={{ width: 15, height: 15, resizeMode: 'contain' }}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  } else if (currentScreen === 'connecting') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Add Device</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>Available Device</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.connectingContainer}>
          <ActivityIndicator size="large" color="#008EFB" />
          <Text style={styles.connectingText}>Connecting to device...</Text>
          <Text style={styles.connectingSubtext}>
            Configuring WiFi connection
          </Text>
        </View>
      </SafeAreaView>
    );
  } else if (currentScreen === 'success') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Add Device</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>Available Device</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  // Removed misplaced closing brace here
  } else if (currentScreen === 'dashboard') {
    screenContent = (
      <View style={styles.dashboardContainer}>
        <View style={styles.dashboardContent}>
          <Text style={styles.welcomeText}>Welcome to the Device</Text>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              { margin: 10, alignSelf: 'flex-end', paddingHorizontal: 24 },
            ]}
            onPress={() => setCurrentScreen('scanning')}
          >
            <Text style={styles.primaryButtonText}>Add Device</Text>
          </TouchableOpacity>
          <ScrollView
            style={styles.devicesScrollView}
            showsVerticalScrollIndicator={false}
          >
            {connectedDevices.map(device => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Always render the modals so they overlay any screen
  return (
    <>
      {screenContent}
      {/* WiFi Configuration Modal */}
      <Modal
        visible={showWifiModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWifiModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>WiFi Configuration</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>SSID ID</Text>
              <TextInput
                style={styles.textInput}
                value={wifiSSID}
                onChangeText={setWifiSSID}
                placeholder="Enter WiFi SSID"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...styles.textInput,
                  paddingVertical: 0,
                }}
              >
                <TextInput
                  style={[{ flex: 1, color: '#111827' }]}
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  placeholder="Enter WiFi Password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(prev => !prev)}
                  style={{ marginLeft: 8 }}
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  <Image
                    source={require('./src/assets/eyeHide.png')}
                    style={{
                      width: 18,
                      height: 18,
                      tintColor: showPassword ? '#008EFB' : '#9ca3af',
                    }}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowWifiModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={connectToDevice}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Success Modal Popup */}
      <Modal
        visible={currentScreen === 'success'}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.successText}>Connected</Text>
            <Text style={styles.successSubtext}>
              You have connected to the device
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#2d2d2d',
  },
  dashboardHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#9ca3af',
  },
  dashboardContent: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingTop: 20,
  },
  time: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalBars: {
    flexDirection: 'row',
    gap: 2,
  },
  bar: {
    width: 3,
    height: 12,
    borderRadius: 1,
    backgroundColor: '#000000',
  },
  barActive: {
    backgroundColor: '#000000',
  },
  wifiIcon: {
    fontSize: 14,
  },
  batteryIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryBody: {
    width: 22,
    height: 11,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 2,
    backgroundColor: '#000000',
  },
  batteryTip: {
    width: 1,
    height: 6,
    backgroundColor: '#000000',
    marginLeft: 1,
  },
  header: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
    marginVertical: 24,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#008EFB',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  scanningCircle: {
    // flex: 1,
    marginTop: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgress: {
    width: Dimensions.get('window').width * .8,
    height: Dimensions.get('window').width * .8,
    borderRadius: 1000,
    borderWidth: 4,
    borderColor: '#008EFB', // default, overridden by Animated.View
    // borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  deviceIcon: {
    alignItems: 'center',
  },
  deviceBox: {
    width: 60,
    height: 40,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 8,
  },
  phoneIcon: {
    width: 30,
    height: 50,
    backgroundColor: '#008EFB',
    borderRadius: 6,
  },
  deviceList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  availableDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceIconText: {
    fontSize: 20,
    marginRight: 12,
  },
  availableDeviceName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  copyButton: {
    padding: 8,
  },
  copyButtonText: {
    fontSize: 16,
  },
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  connectingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 24,
    textAlign: 'center',
  },
  connectingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#008EFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 30,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000000',
    marginVertical: 30,
  },
  devicesScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  deviceCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderColor: '#DEDEDE',
    borderWidth: .5,
  },
  deviceIdBadge: {
    backgroundColor: '#008EFB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: 20,
  },
  deviceIdText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
  },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  statusPillTrue: {
    backgroundColor: '#ef4444',
  },
  statusPillFalse: {
    backgroundColor: '#22c55e',
  },
  statusPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  modalButtons: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignSelf: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    // flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  connectButton: {
    // flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#008EFB',
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  bottomIndicator: {
    height: 4,
    width: 128,
    backgroundColor: '#000000',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
});

export default App;
