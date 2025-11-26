# Guía de Instalación Completa - Sistema de Rastreo de Drones

## ¿Necesito publicar la página?

**NO es necesario publicar** si vas a usar el sistema solo desde dispositivos conectados al hotspot del Raspberry Pi. 

Hay 2 formas de usar el sistema:

### Opción 1: Servir desde Raspberry Pi (Recomendado para producción)
- El Raspberry Pi sirve tanto el backend como el frontend
- Acceso vía: `http://192.168.4.1` (sin puerto)
- **No requiere publicar en Lovable**
- Funciona sin internet

### Opción 2: Desarrollo local
- Frontend en tu computadora (Lovable)
- Backend en Raspberry Pi
- Solo para desarrollo y pruebas
- Requiere ambos dispositivos en la misma red

---

## PASO 1: Preparar el Raspberry Pi

### 1.1 Instalar Raspberry Pi OS

```bash
# Si ya tienes Raspberry Pi OS instalado, salta este paso
# Descargar desde: https://www.raspberrypi.com/software/
```

### 1.2 Actualizar el sistema

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 1.3 Instalar Python y dependencias

```bash
# Instalar pip
sudo apt-get install python3-pip -y

# Instalar dependencias del servidor
pip3 install flask flask-socketio flask-cors pyserial eventlet
```

---

## PASO 2: Configurar el Puerto UART

### 2.1 Habilitar UART

```bash
sudo raspi-config
```

1. Ir a: **3 Interface Options**
2. Seleccionar: **I6 Serial Port**
3. "Login shell over serial?" → **No**
4. "Enable serial port hardware?" → **Sí**
5. Reiniciar: `sudo reboot`

### 2.2 Verificar UART

```bash
# Después de reiniciar, verificar
ls -l /dev/ttyS0

# Debes ver algo como:
# crw-rw---- 1 root dialout 4, 64 Nov 26 10:00 /dev/ttyS0
```

### 2.3 Dar permisos (si es necesario)

```bash
sudo chmod 666 /dev/ttyS0
sudo usermod -a -G dialout pi
```

---

## PASO 3: Configurar el Hotspot WiFi

### 3.1 Instalar software necesario

```bash
sudo apt-get install hostapd dnsmasq -y
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
```

### 3.2 Configurar IP estática

```bash
sudo nano /etc/dhcpcd.conf
```

Agregar al final del archivo:

```
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
```

Guardar: `Ctrl+X`, `Y`, `Enter`

### 3.3 Configurar DHCP (dnsmasq)

```bash
# Respaldar configuración original
sudo mv /etc/dnsmasq.conf /etc/dnsmasq.conf.orig

# Crear nueva configuración
sudo nano /etc/dnsmasq.conf
```

Agregar:

```
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
```

Guardar y salir.

### 3.4 Configurar hostapd

```bash
sudo nano /etc/hostapd/hostapd.conf
```

Agregar:

```
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
```

Guardar y salir.

### 3.5 Indicar ubicación del archivo de configuración

```bash
sudo nano /etc/default/hostapd
```

Buscar la línea `#DAEMON_CONF=""` y cambiarla por:

```
DAEMON_CONF="/etc/hostapd/hostapd.conf"
```

Guardar y salir.

### 3.6 Habilitar servicios

```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
```

### 3.7 Reiniciar

```bash
sudo reboot
```

**Después del reinicio, deberías ver la red WiFi "DroneTracker"**

---

## PASO 4: Instalar el Servidor Backend

### 4.1 Crear directorio del proyecto

```bash
mkdir -p ~/drone-tracker
cd ~/drone-tracker
```

### 4.2 Crear el archivo del servidor

```bash
nano server.py
```

Copiar y pegar este código:

```python
from flask import Flask, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import serial
import threading
import time
import random
import os

app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuración
UART_PORT = '/dev/ttyS0'
BAUD_RATE = 9600
SIMULATION_MODE = True  # Cambiar a False para datos UART reales

# Datos en memoria
active_drones = {}
active_stations = {}

# Inicializar estaciones
def init_stations():
    active_stations['ST-01'] = {
        'station_id': 'ST-01',
        'name': 'Estación Alpha',
        'lat': 19.4326,
        'lon': -99.1332,
        'alt': 2240,
        'battery': 85,
        'status': 'OK',
        'time_remaining': 8.5
    }
    active_stations['ST-02'] = {
        'station_id': 'ST-02',
        'name': 'Estación Beta',
        'lat': 19.4200,
        'lon': -99.1500,
        'alt': 2230,
        'battery': 92,
        'status': 'OK',
        'time_remaining': 10.2
    }
    active_stations['ST-03'] = {
        'station_id': 'ST-03',
        'name': 'Estación Gamma',
        'lat': 19.4450,
        'lon': -99.1200,
        'alt': 2250,
        'battery': 78,
        'status': 'OK',
        'time_remaining': 7.1
    }

init_stations()

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
        print("🔄 Running in SIMULATION mode")
        while True:
            # Simular datos de prueba
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
            print(f"✅ Connected to UART on {UART_PORT}")
            
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
            print(f"❌ UART Error: {e}")
            time.sleep(5)

@app.route('/')
def serve_frontend():
    """Serve the frontend"""
    if os.path.exists('dist/index.html'):
        return send_from_directory('dist', 'index.html')
    else:
        return jsonify({
            'message': 'Frontend no encontrado. Por favor, sube los archivos de dist/',
            'status': 'backend_running'
        })

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    if os.path.exists(f'dist/{path}'):
        return send_from_directory('dist', path)
    else:
        return send_from_directory('dist', 'index.html')

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
        'mode': 'simulation' if SIMULATION_MODE else 'uart',
        'status': 'running'
    })

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('✅ Client connected')
    # Send current state to new client
    emit('initial_drones', list(active_drones.values()))
    emit('initial_stations', list(active_stations.values()))

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('👋 Client disconnected')

if __name__ == '__main__':
    # Start UART reader thread
    uart_thread = threading.Thread(target=uart_reader, daemon=True)
    uart_thread.start()
    
    # Start Flask-SocketIO server
    print("🚀 Starting server on http://0.0.0.0:80")
    print("📡 Access at: http://192.168.4.1")
    socketio.run(app, host='0.0.0.0', port=80, debug=False)
```

Guardar: `Ctrl+X`, `Y`, `Enter`

### 4.3 Crear servicio systemd (autostart)

```bash
sudo nano /etc/systemd/system/drone-tracker.service
```

Agregar:

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
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Guardar y salir.

### 4.4 Habilitar y arrancar el servicio

```bash
sudo systemctl daemon-reload
sudo systemctl enable drone-tracker
sudo systemctl start drone-tracker
```

### 4.5 Verificar que funciona

```bash
sudo systemctl status drone-tracker
```

Deberías ver: `Active: active (running)`

---

## PASO 5: Construir y Subir el Frontend

### 5.1 Construir el frontend en Lovable

En tu proyecto de Lovable, haz clic en el botón **"Publish"** (arriba a la derecha) y luego **"Update"**. Esto generará los archivos de producción.

### 5.2 Descargar el código

1. En Lovable, haz clic en **Dev Mode** (arriba izquierda)
2. Haz clic en el botón de **GitHub** (arriba derecha) 
3. Conecta tu repositorio si no lo has hecho
4. Clona el repositorio en tu computadora:

```bash
git clone [URL_DE_TU_REPO]
cd [NOMBRE_DEL_REPO]
```

### 5.3 Instalar dependencias y construir

```bash
npm install
npm run build
```

Esto creará una carpeta `dist/` con todos los archivos del frontend.

### 5.4 Transferir archivos al Raspberry Pi

Desde tu computadora (asegúrate de estar conectado al hotspot "DroneTracker"):

```bash
# Crear carpeta dist en el Pi
ssh pi@192.168.4.1 "mkdir -p ~/drone-tracker/dist"

# Copiar archivos (desde la carpeta de tu proyecto)
scp -r dist/* pi@192.168.4.1:~/drone-tracker/dist/
```

Contraseña por defecto del Raspberry Pi: `raspberry`

### 5.5 Reiniciar el servicio

```bash
ssh pi@192.168.4.1
sudo systemctl restart drone-tracker
```

---

## PASO 6: Probar el Sistema

### 6.1 Conectarse al hotspot

1. En tu teléfono o computadora, busca la red WiFi **"DroneTracker"**
2. Contraseña: **drones123**
3. Conéctate a la red

### 6.2 Acceder a la aplicación

Abre un navegador y ve a: **http://192.168.4.1**

Deberías ver:
- ✅ Mapa con 3 drones simulados moviéndose
- ✅ 3 estaciones fijas
- ✅ Panel lateral con información de drones
- ✅ Estadísticas en tiempo real

---

## PASO 7: Conectar Datos UART Reales

### 7.1 Conectar el módulo UART

1. **TX del módulo** → **RX del Pi (GPIO 15, pin 10)**
2. **RX del módulo** → **TX del Pi (GPIO 14, pin 8)**
3. **GND** → **GND del Pi**

### 7.2 Cambiar a modo producción

```bash
ssh pi@192.168.4.1
nano ~/drone-tracker/server.py
```

Cambiar la línea:
```python
SIMULATION_MODE = True  # Cambiar a False
```

Por:
```python
SIMULATION_MODE = False  # Modo producción
```

Guardar y reiniciar:
```bash
sudo systemctl restart drone-tracker
```

### 7.3 Verificar logs

```bash
sudo journalctl -u drone-tracker -f
```

---

## Solución de Problemas

### El hotspot no aparece

```bash
sudo systemctl status hostapd
sudo systemctl restart hostapd
sudo systemctl restart dnsmasq
```

### El servidor no arranca

```bash
# Ver logs
sudo journalctl -u drone-tracker -n 50

# Probar manualmente
cd ~/drone-tracker
python3 server.py
```

### No se puede acceder a http://192.168.4.1

```bash
# Verificar que el servicio esté corriendo en puerto 80
sudo netstat -tulpn | grep :80

# Verificar firewall
sudo ufw status

# Si está activo, permitir puerto 80
sudo ufw allow 80
```

### UART no funciona

```bash
# Verificar permisos
ls -l /dev/ttyS0
sudo chmod 666 /dev/ttyS0

# Verificar configuración
sudo raspi-config
# Interface Options -> Serial Port

# Probar UART manualmente
sudo apt-get install minicom
minicom -b 9600 -D /dev/ttyS0
```

---

## Resumen

1. ✅ Configurar Raspberry Pi con Raspberry Pi OS
2. ✅ Habilitar UART
3. ✅ Configurar hotspot WiFi (DroneTracker / drones123)
4. ✅ Instalar servidor Python
5. ✅ Construir frontend y subirlo al Pi
6. ✅ Conectarse al hotspot y acceder a http://192.168.4.1
7. ✅ (Opcional) Conectar módulo UART para datos reales

## Notas Importantes

- **No necesitas publicar en Lovable** para que funcione
- El sistema funciona **sin conexión a internet**
- Todo el procesamiento ocurre en el Raspberry Pi
- Múltiples dispositivos pueden conectarse simultáneamente al hotspot
- Los datos se actualizan en tiempo real vía WebSocket

## Comandos Útiles

```bash
# Ver estado del servidor
sudo systemctl status drone-tracker

# Reiniciar servidor
sudo systemctl restart drone-tracker

# Ver logs en tiempo real
sudo journalctl -u drone-tracker -f

# Detener servidor
sudo systemctl stop drone-tracker

# Ver redes WiFi activas
iwconfig

# Reiniciar servicios de red
sudo systemctl restart hostapd dnsmasq
```
