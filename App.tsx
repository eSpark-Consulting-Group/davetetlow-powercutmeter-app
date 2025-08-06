import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { BLEDevice, ConnectedDevice } from './src/types/ble';
import { useBLE } from './src/hook/useBle';
import { requestBLEPermissions } from './src/utils/blePermission';
import { getDeviceData } from './src/utils/deviceData';
import useSocket from './src/hook/useSocket';
import { storage } from './src/store/mmkv';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>(
    [],
  );
  const [wifiSSID, setWifiSSID] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
  const [connectionStartTime, setConnectionStartTime] = useState<number>(
    Date.now(),
  );
  const [cameFromDashboard, setCameFromDashboard] = useState<boolean>(false);

  const {
    isScanning,
    devices,
    connectedDevice,
    startScan,
    stopScan,
    connectToDevice: connectToBLEDevice,
    disconnect,
    writeData,
    getDiscoveredDevices,
  } = useBLE();

  const borderAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkPermissions = async () => {
      const granted = await requestBLEPermissions();
      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required to proceed.',
        );
      }
    };
    checkPermissions();
    const isFirstTimeDeviceConnected = storage.getBoolean(
      'isFirstTimeDeviceConnected',
    );
    console.log('isFirstTimeDeviceConnected:', isFirstTimeDeviceConnected);
    if (isFirstTimeDeviceConnected) {
      setCurrentScreen('dashboard');
    }
  }, []);

  const handleDeviceUpdate = useCallback((updatedDevice: ConnectedDevice) => {
    setConnectedDevices(prevDevices => {
      const existingIndex = prevDevices.findIndex(
        d => d.device_id === updatedDevice.device_id,
      );

      if (existingIndex !== -1) {
        const updatedList = [...prevDevices];
        updatedList[existingIndex] = updatedDevice;
        return updatedList;
      } else {
        return [...prevDevices, updatedDevice];
      }
    });
  }, []);

  useSocket({
    onDeviceUpdate: handleDeviceUpdate,
  });

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

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#d1d5db', '#008EFB', '#d1d5db'],
  });

  useEffect(() => {
    if (currentScreen === 'dashboard') {
      fetchData();
    }
  }, [currentScreen]);

  useEffect(() => {
    const backAction = () => {
      if (cameFromDashboard) {
        handleBackPress();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [cameFromDashboard, currentScreen]);

  const fetchData = async () => {
    const response = await getDeviceData();
    if (response.status) {
      setConnectedDevices(response.deviceData || []);
    } else {
      console.error('Error:', response?.message);
    }
  };

  const handleBackPress = () => {
    setCameFromDashboard(false);
    setCurrentScreen('dashboard');
  };

  const startScanning = async (): Promise<void> => {
    try {
      await startScan();
      setTimeout(async () => {
        const allDevices = await getDiscoveredDevices();
        await stopScan();
        setCurrentScreen('deviceList');
        console.log('Cache devices:', allDevices.length);
      }, 10000);
    } catch (error) {
      Alert.alert(
        'Scan Error',
        error instanceof Error ? error.message : 'Failed to start scanning',
      );
    }
  };

  const selectDevice = (device: any): void => {
    console.log('Selected device:', device);
    connectToDevice();
    setShowWifiModal(true);
  };

  const connectToDevice = async (): Promise<void> => {
    if (devices.length === 0) {
      Alert.alert('Error', 'No device selected');
      return;
    }

    try {
      const deviceToConnect = devices[0];
      const connectionStartTimeUTC = Date.now();
      setConnectionStartTime(connectionStartTimeUTC);
      await connectToBLEDevice(deviceToConnect);
    } catch (error) {
      Alert.alert(
        'Connection Error',
        'Failed to connect to the device. Please try again.',
      );
    }
  };

  const configureWiFi = async (): Promise<void> => {
    if (!wifiSSID || !wifiPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setShowWifiModal(false);
    setCurrentScreen('connecting');
    const SERVICE_UUID = '00000180-0000-1000-8000-00805f9b34fb';
    const WIFI_CHARACTERISTIC = '0000CDAD-0000-1000-8000-00805f9b34fb';
    const wifiCredentials = { ssid: wifiSSID, password: wifiPassword };
    const jsonString = JSON.stringify(wifiCredentials);
    const credentialsBytes = Array.from(new TextEncoder().encode(jsonString));
    console.log('Sending WiFi credentials:', jsonString);
    writeData(SERVICE_UUID, WIFI_CHARACTERISTIC, credentialsBytes)
      .then(() => {
        getAllRegisteredDevices();
      })
      .catch(err => {
        getAllRegisteredDevices();
      });
  };

  const getAllRegisteredDevices = async () => {
    setTimeout(async () => {
      const response = await getDeviceData();

      console.log('response', response);

      if (response.status) {
        const filteredDevices = response.deviceData?.filter(
          device => device.device_id === connectedDevice?.name,
        );
        console.log(
          'connectedDevice?.id:',
          JSON.stringify(connectedDevice?.name),
        );
        console.log('deviceTimestamp:', JSON.stringify(filteredDevices));

        if (filteredDevices && filteredDevices.length > 0) {
          const hasFutureTimestamp = filteredDevices.some(device => {
            const deviceTimestamp = new Date(
              device.timestamp.replace(' ', 'T') + 'Z',
            ).getTime();
            console.log('deviceTimestamp:', deviceTimestamp);
            console.log('connectionStartTime:', connectionStartTime);
            return connectionStartTime < deviceTimestamp;
          });

          console.log('Filtered devices:', hasFutureTimestamp);
          if (hasFutureTimestamp) {
            setCurrentScreen('success');
            setTimeout(() => {
              storage.set('isFirstTimeDeviceConnected', true);
              setCurrentScreen('dashboard');
            }, 2000);
          } else {
            Alert.alert(
              'Connection Error',
              'Failed to connect to the device. Please try again.',
            );
            setCurrentScreen('deviceList');
          }
        } else {
          Alert.alert(
            'Connection Error',
            'Failed to connect to the device. Please try again.',
          );
          setCurrentScreen('deviceList');
        }
      } else {
        console.error('Error:', response?.message);
      }
    }, 10000);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  const DeviceCard: React.FC<{ device: ConnectedDevice }> = ({ device }) => {
    const { device_id, data } = device;

    const formatKey = (key: string) =>
      key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
      <View style={styles.deviceCard}>
        <View style={styles.deviceIdBadge}>
          <Text style={styles.deviceIdText}>Device ID_{device_id}</Text>
        </View>

        {data ? (
          Object.entries(data).map(([key, value]) => (
            <View style={styles.statusRow} key={key}>
              <Text style={styles.statusLabel}>{formatKey(key)}</Text>
              {typeof value === 'boolean' ? (
                <StatusPill status={value} />
              ) : (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: '#f3f4f6', minWidth: 80 },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: '#374151' }]}>
                    {String(value)}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.statusLabel}>No data available</Text>
        )}
      </View>
    );
  };

  let screenContent;
  if (currentScreen === 'scanning') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          {cameFromDashboard && (
            <Icon
              name="chevron-left"
              size={28}
              style={styles.icon}
              color="#000"
              onPress={handleBackPress}
            />
          )}
          <Text style={styles.header}>Add Device</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={startScanning}
            disabled={isScanning}
          >
            <Text style={styles.primaryButtonText}>
              {isScanning ? 'Scanning Nearby Device...' : 'Scan Nearby Device'}
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
        {isScanning && (
          <View style={styles.scanningInfo}>
            <Text style={styles.scanningText}>
              Looking for ESP32 devices...
            </Text>
            <Text style={styles.foundDevicesText}>
              Found {devices.length} devices
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  } else if (currentScreen === 'deviceList') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          {cameFromDashboard && (
            <Icon
              name="chevron-left"
              size={28}
              style={styles.icon}
              color="#000"
              onPress={handleBackPress}
            />
          )}
          <Text style={styles.header}>Add Device</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>
              Available Devices ({devices.length})
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.deviceList}>
          {devices.length === 0 ? (
            <View style={styles.noDevicesContainer}>
              <Text style={styles.noDevicesText}>No devices found</Text>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setCurrentScreen('scanning');
                  startScanning();
                }}
              >
                <Text style={styles.secondaryButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            devices.map((device: BLEDevice, index: number) => (
              <TouchableOpacity
                key={device.id || index}
                style={styles.availableDeviceItem}
                onPress={() => selectDevice(device)}
              >
                <View style={styles.deviceIcon}>
                  <Image
                    source={require('./src/assets/device.png')}
                    style={{ width: 25, height: 25, marginRight: 10 }}
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.availableDeviceName}>
                    {device.name || `Device ${device.id}`}
                  </Text>
                  {device.rssi && (
                    <Text style={styles.deviceRssi}>
                      Signal: {device.rssi} dBm
                    </Text>
                  )}
                </View>
                <View style={styles.deviceIcon}>
                  <Image
                    source={require('./src/assets/lock.png')}
                    style={{ width: 15, height: 15, resizeMode: 'contain' }}
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  } else if (currentScreen === 'connecting') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          {cameFromDashboard && (
            <Icon
              name="chevron-left"
              size={28}
              style={styles.icon}
              color="#000"
              onPress={handleBackPress}
            />
          )}
          <Text style={styles.header}>Add Device</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>Connecting Device</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.connectingContainer}>
          <ActivityIndicator size="large" color="#008EFB" />
          <Text style={styles.connectingText}>Connecting to device...</Text>
          <Text style={styles.connectingSubtext}>
            Configuring WiFi connection
          </Text>
          {connectedDevice && (
            <Text style={styles.connectedDeviceText}>
              Connected to: {connectedDevice.name || connectedDevice.id}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  } else if (currentScreen === 'success') {
    screenContent = (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          {cameFromDashboard && (
            <Icon
              name="chevron-left"
              size={28}
              style={styles.icon}
              color="#000"
              onPress={handleBackPress}
            />
          )}
          <Text style={styles.header}>Add Device</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.primaryButton]}>
            <Text style={styles.primaryButtonText}>Device Connected</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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
            onPress={() => {
              setCameFromDashboard(true);
              setCurrentScreen('scanning');
              if (connectedDevice) {
                disconnect().catch(console.error);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Add Device</Text>
          </TouchableOpacity>
          <ScrollView
            style={styles.devicesScrollView}
            showsVerticalScrollIndicator={false}
          >
            {connectedDevices.map(device => (
              <DeviceCard key={device.device_id} device={device} />
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <>
      {screenContent}
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
                onPress={() => {
                  disconnect().catch(console.error);
                  setShowWifiModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={() => {
                  configureWiFi();
                }}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  icon: {
    paddingBottom: 8,
    paddingTop: 8,
  },
  header: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
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
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    paddingVertical: 12,
    borderColor: '#d1d5db',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 12,
  },
  scanningCircle: {
    marginTop: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgress: {
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    borderRadius: 1000,
    borderWidth: 4,
    borderColor: '#008EFB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  deviceIcon: {
    alignItems: 'center',
  },
  scanningInfo: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 24,
  },
  scanningText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  foundDevicesText: {
    fontSize: 14,
    color: '#008EFB',
    fontWeight: '500',
  },
  deviceList: {
    paddingHorizontal: 24,
  },
  noDevicesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDevicesText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  availableDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  availableDeviceName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  deviceRssi: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
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
  connectedDeviceText: {
    fontSize: 12,
    color: '#008EFB',
    marginTop: 16,
    textAlign: 'center',
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
    borderWidth: 0.5,
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
    alignSelf: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#008EFB',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backIcon: {
    fontSize: 20,
    color: '#374151',
    fontWeight: '600',
  },

  headerSpacer: {
    width: 60,
  },
  connectButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});
export default App;
