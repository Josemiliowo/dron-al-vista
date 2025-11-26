# Frontend Setup - Sistema de Rastreo de Drones

## Descripción

Este es el frontend web del Sistema de Rastreo de Drones, construido con React, TypeScript, Tailwind CSS y Leaflet.js. Muestra un mapa interactivo en tiempo real con la posición de drones y estaciones de monitoreo.

## Características

✅ **Mapa interactivo** con Leaflet.js
✅ **Actualización en tiempo real** vía WebSocket
✅ **Visualización de drones** con markers dinámicos según altitud
✅ **Estaciones de monitoreo** con información de batería y estado
✅ **Rastros de vuelo** para cada drone
✅ **Panel lateral** con lista de detecciones
✅ **Estadísticas en tiempo real**: detecciones totales, altitud promedio, velocidad promedio
✅ **Modo simulación** para desarrollo y pruebas
✅ **Diseño responsive** para móviles y tablets
✅ **Interfaz en español**

## Modo de Operación

### Modo Simulación (Actual)

El frontend está configurado para funcionar con datos simulados, perfecto para:
- Desarrollo y pruebas
- Demostración sin hardware
- Testing de interfaz

Los datos simulados incluyen:
- 3 drones con movimiento aleatorio
- 3 estaciones fijas
- Actualización cada 2 segundos
- Rastros de vuelo

### Modo Producción

Para conectar al backend real de Raspberry Pi:

1. **Configurar la URL del backend**

Edita `src/pages/Index.tsx` y reemplaza el mock service con el WebSocket service:

```typescript
import { websocketService } from "@/services/websocketService";

// En useEffect, reemplazar:
useEffect(() => {
  // Conectar al backend real
  websocketService.connect('http://192.168.4.1:5000');
  
  websocketService.subscribeDrones((updatedDrones) => {
    setDrones(updatedDrones);
  });
  
  websocketService.subscribeStations((updatedStations) => {
    setStations(updatedStations);
  });
  
  websocketService.subscribeConnected((status) => {
    setIsConnected(status);
  });

  return () => {
    websocketService.disconnect();
  };
}, []);
```

2. **Construir para producción**

```bash
npm run build
```

3. **Servir desde Raspberry Pi**

Opción A - Servir con Flask:

```python
# En server.py, agregar:
from flask import send_from_directory

@app.route('/')
def serve_frontend():
    return send_from_directory('dist', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('dist', path)
```

Opción B - Usar Nginx:

```bash
# Copiar archivos build al Pi
scp -r dist/* pi@192.168.4.1:/var/www/drone-tracker/

# Configurar Nginx
sudo nano /etc/nginx/sites-available/drone-tracker

# Agregar:
server {
    listen 80;
    server_name 192.168.4.1;
    
    root /var/www/drone-tracker;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/drone-tracker /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## Desarrollo Local

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Abre http://localhost:8080

### Build

```bash
npm run build
```

## Estructura del Proyecto

```
src/
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── StatsCard.tsx    # Tarjetas de estadísticas
│   ├── DroneCard.tsx    # Tarjeta de drone en sidebar
│   └── MapView.tsx      # Componente de mapa Leaflet
├── services/
│   ├── mockDroneService.ts    # Servicio de simulación
│   └── websocketService.ts    # Cliente WebSocket real
├── pages/
│   └── Index.tsx        # Página principal
└── index.css           # Estilos y tema

## Personalización

### Cambiar colores del tema

Edita `src/index.css`:

```css
:root {
  --primary: 37 92% 50%;  /* Color principal */
  --secondary: 24 5% 44%; /* Color secundario */
  /* ... más colores */
}
```

### Modificar el mapa

En `src/components/MapView.tsx`:

```typescript
// Cambiar estilo del mapa
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  // Opciones de OpenStreetMap
}).addTo(map.current);

// O usar otro proveedor:
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© CARTO'
}).addTo(map.current);
```

### Ajustar intervalo de actualización

En `src/services/mockDroneService.ts`:

```typescript
this.intervalId = window.setInterval(() => {
  this.updateDrones();
  this.notifyListeners();
}, 2000); // Cambiar 2000 (2 segundos) al intervalo deseado
```

### Modificar iconos de drones

En `src/components/MapView.tsx`:

```typescript
// Cambiar tamaño del marker
const size = 15 + (drone.alt / 200) * 30; // Ajustar fórmula

// Cambiar colores
marker = L.circleMarker([drone.lat, drone.lon], {
  fillColor: '#3b82f6',  // Color de relleno
  color: '#1e40af',      // Color de borde
  // ... más opciones
});
```

## Integración con Hardware

### Formato de datos esperado

El frontend espera recibir del backend:

**Eventos WebSocket:**

1. `initial_drones` - Array de drones al conectar
2. `initial_stations` - Array de estaciones al conectar
3. `drone_update` - Actualización de un drone
4. `station_update` - Actualización de una estación

**Estructura de datos:**

```typescript
// Drone
{
  drone_id: "DRN-001",
  lat: 19.4326,
  lon: -99.1332,
  alt: 120,
  speed: 15,
  timestamp: 1234567890
}

// Station
{
  station_id: "ST-01",
  name: "Estación Alpha",
  lat: 19.4326,
  lon: -99.1332,
  alt: 2240,
  battery: 85,
  status: "OK",
  time_remaining: 8.5
}
```

## Troubleshooting

### El mapa no se muestra

1. Verificar que Leaflet CSS esté cargado
2. Revisar la consola del navegador por errores
3. Verificar conexión a internet (para tiles de OpenStreetMap)

### WebSocket no conecta

1. Verificar que el backend esté corriendo
2. Revisar la URL en la configuración
3. Verificar firewall/CORS en el servidor
4. Usar las herramientas de desarrollo del navegador (Network tab)

### Los drones no se actualizan

1. Verificar que el evento WebSocket se esté recibiendo
2. Revisar la consola del navegador
3. Verificar que el formato de datos sea correcto

## Características Futuras

- [ ] Filtrado de drones por altitud/velocidad
- [ ] Visualización de geofencing
- [ ] Exportación de datos a CSV
- [ ] Gráficas históricas de altitud/velocidad
- [ ] Alertas de batería baja en estaciones
- [ ] Modo oscuro manual
- [ ] Múltiples capas de mapa (satélite, terreno)
- [ ] Reproducción de trayectorias históricas

## Soporte

Para más información, consulta:
- [Documentación de Leaflet](https://leafletjs.com/)
- [Documentación de Socket.IO](https://socket.io/docs/)
- [React Query](https://tanstack.com/query/)
- [Tailwind CSS](https://tailwindcss.com/)

## Licencia

MIT
```
