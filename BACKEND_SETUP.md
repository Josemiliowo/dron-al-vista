# Backend Setup - Sistema de Rastreo de Drones

Este documento describe cómo configurar el backend Python/Flask en tu Raspberry Pi.

## Requisitos

- Raspberry Pi con Python 3.9+
- Puerto UART configurado
- Conexión a red (hotspot o WiFi)

## Instalación

### 1. Instalar dependencias

```bash
pip3 install flask flask-socketio flask-cors pyserial eventlet
```

### 2. Crear el archivo del servidor

Crea `server.py` en tu Raspberry Pi:

```python
from flask import Flask, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import serial
import threading
import time
import json

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuración
UART_PORT = '/dev/ttyS0'
BAUD_RATE = 9600
SIMULATION_MODE = False  # Cambiar a False para datos reales

# Datos en memoria
active_drones = {}
active_stations = {}

def parse_uart_data(line):
    """Parse UART data lines"""
    try:
        parts = line.strip().split(',')
        
        # Formato drone: drone_id,lat,lon,alt,name
        if parts[0].startswith('DRN-'):
            return {
                'type': 'drone',
                'drone_id': parts[0],
                'lat': float(parts[1]),
                'lon': float(parts[2]),
                'alt': float(parts[3]),
                'name': parts[4] if len(parts) > 4 else parts[0],
                'timestamp': time.time()
            }
        
        # Formato station: station_id,lat,lon,alt,battery,status,time_remaining,name
        elif parts[0].startswith('ST-'):
            return {
                'type': 'station',
                'station_id': parts[0],
                'lat': float(parts[1]),
                'lon': float(parts[2]),
                'alt': float(parts[3]),
                'battery': int(parts[4]),
                'status': parts[5],
                'time_remaining': float(parts[6]),
                'name': parts[7] if len(parts) > 7 else parts[0]
            }
    except Exception as e:
        print(f"Error parsing data: {e}")
    
    return None

def uart_reader():
    """Background thread to read UART data"""
    if SIMULATION_MODE:
        print("Running in SIMULATION mode")
        while True:
            # Simular datos de prueba
            import random
            drone_id = f"DRN-{random.randint(1, 3):03d}"
            drone_names = {
                'DRN-001': 'Halcón 1',
                'DRN-002': 'Águila 2',
                'DRN-003': 'Cóndor 3'
            }
            data = {
                'type': 'drone',
                'drone_id': drone_id,
                'name': drone_names.get(drone_id, drone_id),
                'lat': 19.4326 + random.uniform(-0.01, 0.01),
                'lon': -99.1332 + random.uniform(-0.01, 0.01),
                'alt': random.randint(50, 200),
                'timestamp': time.time()
            }
            active_drones[drone_id] = data
            socketio.emit('drone_update', data)
            time.sleep(2)
    else:
        try:
            ser = serial.Serial(UART_PORT, BAUD_RATE, timeout=1)
            print(f"Connected to UART on {UART_PORT}")
            
            while True:
                if ser.in_waiting:
                    line = ser.readline().decode('utf-8', errors='ignore')
                    data = parse_uart_data(line)
                    
                    if data:
                        if data['type'] == 'drone':
                            active_drones[data['drone_id']] = data
                            socketio.emit('drone_update', data)
                        elif data['type'] == 'station':
                            active_stations[data['station_id']] = data
                            socketio.emit('station_update', data)
                
                time.sleep(0.1)
        except Exception as e:
            print(f"UART Error: {e}")
            time.sleep(5)

@app.route('/api/drones')
def get_drones():
    """Get list of active drones"""
    return jsonify(list(active_drones.values()))

@app.route('/api/stations')
def get_stations():
    """Get list of active stations"""
    return jsonify(list(active_stations.values()))

@app.route('/api/status')
def get_status():
    """Get system status"""
    return jsonify({
        'active_drones': len(active_drones),
        'active_stations': len(active_stations),
        'uptime': time.time(),
        'mode': 'simulation' if SIMULATION_MODE else 'uart'
    })

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    # Send current state to new client
    emit('initial_drones', list(active_drones.values()))
    emit('initial_stations', list(active_stations.values()))

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

if __name__ == '__main__':
    # Start UART reader thread
    uart_thread = threading.Thread(target=uart_reader, daemon=True)
    uart_thread.start()
    
    # Start Flask-SocketIO server
    print("Starting server on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)
```

### 3. Crear archivo de configuración

Crea `config.json`:

```json
{
  "uart": {
    "port": "/dev/ttyS0",
    "baud_rate": 9600
  },
  "server": {
    "host": "0.0.0.0",
    "port": 5000
  },
  "map": {
    "default_center": [19.4326, -99.1332],
    "default_zoom": 13
  },
  "simulation_mode": false
}
```

### 4. Configurar UART en Raspberry Pi

```bash
# Habilitar UART
sudo raspi-config
# Navegar a: Interface Options -> Serial Port
# ¿Login shell over serial? -> No
# ¿Enable serial port hardware? -> Yes

# Verificar UART
ls -l /dev/ttyS0
```

### 5. Configurar hotspot en Raspberry Pi

```bash
# Instalar hostapd y dnsmasq
sudo apt-get install hostapd dnsmasq

# Configurar IP estática
sudo nano /etc/dhcpcd.conf
# Agregar:
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant

# Configurar dnsmasq
sudo nano /etc/dnsmasq.conf
# Agregar:
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h

# Configurar hostapd
sudo nano /etc/hostapd/hostapd.conf
# Agregar:
interface=wlan0
driver=nl80211
ssid=DroneTracker
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=drones123
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP

# Habilitar servicios
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
```

### 6. Ejecutar el servidor

```bash
# Modo simulación (para pruebas)
python3 server.py

# Modo producción con datos UART reales
# Editar server.py y cambiar SIMULATION_MODE = False
python3 server.py
```

### 7. Configurar autostart

Crea `/etc/systemd/system/drone-tracker.service`:

```ini
[Unit]
Description=Drone Tracker Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/drone-tracker
ExecStart=/usr/bin/python3 /home/pi/drone-tracker/server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Habilitar el servicio:

```bash
sudo systemctl enable drone-tracker
sudo systemctl start drone-tracker
sudo systemctl status drone-tracker
```

## Uso

1. Conecta tu dispositivo al hotspot "DroneTracker" (contraseña: drones123)
2. Abre el navegador en: `http://192.168.4.1:5000`
3. El sistema mostrará drones y estaciones en tiempo real

## Formato de datos UART

### Drones
```
DRN-001,19.4326,-99.1332,120,Halcón 1
```
Formato: `drone_id,lat,lon,alt,name`

### Estaciones
```
ST-01,19.4326,-99.1332,2240,85,OK,8.5,Estación Alpha
```
Formato: `station_id,lat,lon,alt,battery%,status,time_remaining,name`

## Troubleshooting

### UART no funciona
- Verificar permisos: `sudo chmod 666 /dev/ttyS0`
- Verificar que esté habilitado en raspi-config
- Revisar logs: `dmesg | grep tty`

### Hotspot no aparece
- Verificar servicios: `sudo systemctl status hostapd`
- Revisar configuración: `sudo nano /etc/hostapd/hostapd.conf`

### Conexión WebSocket falla
- Verificar firewall: `sudo ufw status`
- Verificar puerto: `sudo netstat -tulpn | grep 5000`

## Características adicionales

### Exportar datos a CSV

Agrega al `server.py`:

```python
import csv
from datetime import datetime

@app.route('/api/export')
def export_data():
    filename = f'drones_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    with open(filename, 'w', newline='') as csvfile:
        fieldnames = ['drone_id', 'lat', 'lon', 'alt', 'speed', 'timestamp']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for drone in active_drones.values():
            writer.writerow(drone)
    return jsonify({'filename': filename, 'status': 'success'})
```

### Alertas de geofencing

```python
def check_geofence(lat, lon, center_lat, center_lon, radius_km):
    from math import radians, cos, sin, asin, sqrt
    
    lon1, lat1, lon2, lat2 = map(radians, [lon, lat, center_lon, center_lat])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    
    return km > radius_km
```

## Requirements.txt

```txt
flask==3.0.0
flask-socketio==5.3.5
flask-cors==4.0.0
pyserial==3.5
eventlet==0.33.3
python-engineio==4.8.0
python-socketio==5.10.0
```
