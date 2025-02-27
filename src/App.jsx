import { useEffect, useState } from "react";
import { Stage, Sprite, Text, Container } from "@pixi/react";
import "./App.css";

const App = () => {
  // Array de beacons predefinidos (solo 3 beacons)
  const [beacons, setBeacons] = useState([
    { id: 1, name: "Beacon 1", mac: "C300002267E5", x: 100, y: 100 },
    { id: 2, name: "Beacon 2", mac: "C30000354980", x: 400, y: 150 },
    { id: 3, name: "Beacon 3", mac: "C300002267E8", x: 700, y: 300 },
  ]);

  // Vehículos activos, cada uno identificado por su gateway
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    // Conexión al servidor WebSocket (ajusta la URL según tu configuración)
    const socket = new WebSocket("ws://192.168.0.33:9010");

    socket.onopen = () => {
      console.log("Conectado al WebSocket");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Mensaje recibido:", data);
      updateVehicleFromMessage(data);
    };

    socket.onclose = () => {
      console.log("WebSocket cerrado");
    };

    return () => {
      socket.close();
    };
  }, [beacons]);

  const updateVehicleFromMessage = (data) => {
    // data: { gw: "ac233fc1926b", tm: "timestamp", adv: [ { uuid, major, minor, mac, rssi } ] }
    if (!data.adv || data.adv.length === 0) return;
    // Seleccionamos el beacon con el RSSI más alto
    const beaconData = data.adv.reduce((a, b) => (a.rssi > b.rssi ? a : b));

    // Buscar el beacon en nuestro array usando la MAC
    const beacon = beacons.find((b) => b.mac === beaconData.mac);
    if (!beacon) {
      console.log("Beacon no encontrado para MAC:", beaconData.mac);
      return;
    }

    const now = new Date().toISOString();

    // Actualizar (o crear) el vehículo correspondiente al gateway recibido
    setVehicles((prevVehicles) => {
      const existingVehicle = prevVehicles.find((v) => v.gateway === data.gw);
      if (existingVehicle) {
        let updatedHistory = [...existingVehicle.history];
        if (
          !existingVehicle.currentBeacon ||
          existingVehicle.currentBeacon.id !== beacon.id
        ) {
          // Finalizamos el registro del beacon anterior si existe
          if (existingVehicle.currentBeacon && updatedHistory.length > 0) {
            const lastRecord = updatedHistory[updatedHistory.length - 1];
            if (!lastRecord.exitTime) {
              lastRecord.exitTime = now;
              const duration =
                (new Date(now) - new Date(lastRecord.entryTime)) / 1000;
              lastRecord.duration = Math.round(duration);
            }
          }
          // Agregamos un nuevo registro para el beacon actual
          updatedHistory.push({
            beaconId: beacon.id,
            beaconName: beacon.name,
            entryTime: now,
            exitTime: null,
            duration: null,
          });
        }
        return prevVehicles.map((v) =>
          v.gateway === data.gw
            ? {
                ...v,
                currentBeacon: beacon,
                position: { x: beacon.x, y: beacon.y },
                history: updatedHistory,
              }
            : v
        );
      } else {
        // Si es un vehículo nuevo, lo creamos
        return [
          ...prevVehicles,
          {
            id: prevVehicles.length + 1,
            name: `Vehicle ${prevVehicles.length + 1}`,
            gateway: data.gw,
            active: true,
            currentBeacon: beacon,
            position: { x: beacon.x, y: beacon.y },
            history: [
              {
                beaconId: beacon.id,
                beaconName: beacon.name,
                entryTime: now,
                exitTime: null,
                duration: null,
              },
            ],
          },
        ];
      }
    });
  };

  return (
    <div className="app-container">
      <h1 className="title">RFID Tracking System con WebSocket</h1>

      <div className="stage-container">
        <Stage width={800} height={600} options={{ backgroundColor: 0x1099bb }}>
          {/* Fondo */}
          <Sprite image="./bg.png" x={0} y={0} width={800} height={600} />

          {/* Renderizado de beacons */}
          {beacons.map((beacon) => (
            <Container
              key={beacon.id}
              x={beacon.x}
              y={beacon.y}
              interactive
              pointerdown={() =>
                alert(`Beacon: ${beacon.name}\nMAC: ${beacon.mac}`)
              }
            >
              <Sprite image="./tag.png" anchor={0.5} width={30} height={30} />
              <Text
                text={beacon.name}
                y={-20}
                style={{ fill: "black", fontSize: 12 }}
                anchor={0.5}
              />
            </Container>
          ))}

          {/* Renderizado de vehículos */}
          {vehicles.map((vehicle) => (
            <Container key={vehicle.id}>
              <Sprite
                image="./vehicle.png"
                x={vehicle.position.x}
                y={vehicle.position.y}
                anchor={0.5}
                width={70}
                height={50}
              />
              <Text
                text={vehicle.name}
                x={vehicle.position.x}
                y={vehicle.position.y - 40}
                style={{ fill: "white", fontSize: 12 }}
                anchor={0.5}
              />
            </Container>
          ))}
        </Stage>
      </div>

      {/* Historial de vehículos */}
      <div className="history-container">
        <h2>Historial de Vehículos</h2>
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="vehicle-history">
            <h3>
              {vehicle.name} (Gateway: {vehicle.gateway})
            </h3>
            {vehicle.history.length === 0 ? (
              <p>No hay historial</p>
            ) : (
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Beacon</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Duración (seg)</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.history.map((record, idx) => (
                    <tr key={idx}>
                      <td>{record.beaconName}</td>
                      <td>{record.entryTime}</td>
                      <td>{record.exitTime || "-"}</td>
                      <td>{record.duration || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
