// WebSocket service for connecting to real Flask backend
import { io, Socket } from 'socket.io-client';
import { DroneData, StationData } from './mockDroneService';

export class WebSocketService {
  private socket: Socket | null = null;
  private listeners: {
    drones: ((drones: DroneData[]) => void)[];
    stations: ((stations: StationData[]) => void)[];
    connected: ((status: boolean) => void)[];
  } = {
    drones: [],
    stations: [],
    connected: []
  };

  connect(url: string = 'http://192.168.4.1:5000') {
    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Connected to backend');
      this.notifyConnected(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from backend');
      this.notifyConnected(false);
    });

    this.socket.on('initial_drones', (drones: any[]) => {
      const parsedDrones = drones.map(d => ({
        drone_id: d.drone_id,
        name: d.name || d.drone_id,
        lat: d.lat,
        lon: d.lon,
        alt: d.alt,
        timestamp: new Date(d.timestamp * 1000),
        trail: [[d.lat, d.lon] as [number, number]]
      }));
      this.notifyDrones(parsedDrones);
    });

    this.socket.on('initial_stations', (stations: any[]) => {
      this.notifyStations(stations);
    });

    this.socket.on('drone_update', (drone: any) => {
      const parsedDrone: DroneData = {
        drone_id: drone.drone_id,
        name: drone.name || drone.drone_id,
        lat: drone.lat,
        lon: drone.lon,
        alt: drone.alt,
        timestamp: new Date(drone.timestamp * 1000),
        trail: [[drone.lat, drone.lon] as [number, number]]
      };
      // Note: This sends individual updates, the component merges them
      this.notifyDrones([parsedDrone]);
    });

    this.socket.on('station_update', (station: any) => {
      this.notifyStations([station]);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.notifyConnected(false);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  subscribeDrones(callback: (drones: DroneData[]) => void) {
    this.listeners.drones.push(callback);
  }

  subscribeStations(callback: (stations: StationData[]) => void) {
    this.listeners.stations.push(callback);
  }

  subscribeConnected(callback: (status: boolean) => void) {
    this.listeners.connected.push(callback);
  }

  private notifyDrones(drones: DroneData[]) {
    this.listeners.drones.forEach(callback => callback(drones));
  }

  private notifyStations(stations: StationData[]) {
    this.listeners.stations.forEach(callback => callback(stations));
  }

  private notifyConnected(status: boolean) {
    this.listeners.connected.forEach(callback => callback(status));
  }
}

export const websocketService = new WebSocketService();
