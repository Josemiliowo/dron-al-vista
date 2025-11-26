// Mock service to simulate drone data from UART/WebSocket
export interface DroneData {
  drone_id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  timestamp: Date;
  trail: [number, number][];
}

export interface StationData {
  station_id: string;
  lat: number;
  lon: number;
  alt: number;
  battery: number;
  status: 'OK' | 'WARNING' | 'ERROR';
  time_remaining: number;
  name: string;
}

export class MockDroneService {
  private drones: Map<string, DroneData> = new Map();
  private stations: Map<string, StationData> = new Map();
  private listeners: ((drones: DroneData[], stations: StationData[]) => void)[] = [];
  private intervalId?: number;

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize stations
    this.stations.set('ST-01', {
      station_id: 'ST-01',
      name: 'Estación Alpha',
      lat: 19.4326,
      lon: -99.1332,
      alt: 2240,
      battery: 85,
      status: 'OK',
      time_remaining: 8.5
    });

    this.stations.set('ST-02', {
      station_id: 'ST-02',
      name: 'Estación Beta',
      lat: 19.4200,
      lon: -99.1500,
      alt: 2230,
      battery: 92,
      status: 'OK',
      time_remaining: 10.2
    });

    this.stations.set('ST-03', {
      station_id: 'ST-03',
      name: 'Estación Gamma',
      lat: 19.4450,
      lon: -99.1200,
      alt: 2250,
      battery: 78,
      status: 'OK',
      time_remaining: 7.1
    });

    // Initialize drones with trails
    this.drones.set('DRN-001', {
      drone_id: 'DRN-001',
      name: 'Halcón 1',
      lat: 19.4326,
      lon: -99.1332,
      alt: 120,
      timestamp: new Date(),
      trail: [[19.4326, -99.1332]]
    });

    this.drones.set('DRN-002', {
      drone_id: 'DRN-002',
      name: 'Águila 2',
      lat: 19.4280,
      lon: -99.1450,
      alt: 85,
      timestamp: new Date(),
      trail: [[19.4280, -99.1450]]
    });

    this.drones.set('DRN-003', {
      drone_id: 'DRN-003',
      name: 'Cóndor 3',
      lat: 19.4400,
      lon: -99.1250,
      alt: 150,
      timestamp: new Date(),
      trail: [[19.4400, -99.1250]]
    });
  }

  start() {
    this.intervalId = window.setInterval(() => {
      this.updateDrones();
      this.notifyListeners();
    }, 2000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private updateDrones() {
    this.drones.forEach((drone) => {
      // Random movement
      const deltaLat = (Math.random() - 0.5) * 0.002;
      const deltaLon = (Math.random() - 0.5) * 0.002;
      const deltaAlt = (Math.random() - 0.5) * 10;

      drone.lat += deltaLat;
      drone.lon += deltaLon;
      drone.alt = Math.max(50, Math.min(200, drone.alt + deltaAlt));
      drone.timestamp = new Date();

      // Add to trail (keep last 20 points)
      drone.trail.push([drone.lat, drone.lon]);
      if (drone.trail.length > 20) {
        drone.trail.shift();
      }
    });
  }

  private notifyListeners() {
    const dronesArray = Array.from(this.drones.values());
    const stationsArray = Array.from(this.stations.values());
    this.listeners.forEach(listener => listener(dronesArray, stationsArray));
  }

  subscribe(callback: (drones: DroneData[], stations: StationData[]) => void) {
    this.listeners.push(callback);
    // Send initial data
    callback(Array.from(this.drones.values()), Array.from(this.stations.values()));
  }

  unsubscribe(callback: (drones: DroneData[], stations: StationData[]) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  getDrones(): DroneData[] {
    return Array.from(this.drones.values());
  }

  getStations(): StationData[] {
    return Array.from(this.stations.values());
  }
}

export const mockDroneService = new MockDroneService();
