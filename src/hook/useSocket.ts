import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectedDevice } from '../types/ble';

type UseSocketProps = {
  onDeviceUpdate: (device: ConnectedDevice) => void;
};

let socket: Socket | null = null;

const useSocket = ({onDeviceUpdate }: UseSocketProps) => {
  useEffect(() => {
    if (!socket) {
      socket = io('https://davetetlowbe.esparkconsultants.com');

      socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
      });

      socket.on('device-update', (data: ConnectedDevice) => {
        console.log('Device updated via socket:', data);
        onDeviceUpdate(data);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    }

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [onDeviceUpdate]);
};

export default useSocket;
