import React, { useEffect, useState } from "react";
import { Stage, Sprite, Text, Container } from "@pixi/react";
import * as PIXI from "pixi.js";
import "./App.css";

const App = () => {
  // -------------------------------------------------
  // 1. ESTADOS Y CONFIGURACIÓN BÁSICA
  // -------------------------------------------------
  // Beacons: cada uno con id, name, mac, x, y
  const [beacons, setBeacons] = useState([
    { id: 1, name: "Beacon 1", mac: "C300002267E5", x: 100, y: 100 },
    { id: 2, name: "Beacon 2", mac: "C30000354980", x: 400, y: 150 },
    { id: 3, name: "Beacon 3", mac: "C300002267E8", x: 700, y: 300 },
  ]);

  // Vehículos (se crean/actualizan cuando llegan tramas WS)
  const [vehicles, setVehicles] = useState([]);

  // Formulario para añadir beacons
  const [newBeaconName, setNewBeaconName] = useState("");
  const [newBeaconMac, setNewBeaconMac] = useState("");

  // Estado para saber qué beacon se está arrastrando
  const [draggingBeaconId, setDraggingBeaconId] = useState(null);

  // Estado para habilitar/deshabilitar edición
  const [editing, setEditing] = useState(true);

  // -------------------------------------------------
  // 2. CONEXIÓN WEBSOCKET
  // -------------------------------------------------
  useEffect(() => {
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

  // -------------------------------------------------
  // 3. FUNCIÓN PARA PROCESAR LOS MENSAJES WEBSOCKET
  // -------------------------------------------------
  const updateVehicleFromMessage = (data) => {
    // data: { gw: "ac233fc1926b", tm: "...", adv: [ { mac, rssi, ... } ] }
    if (!data.adv || data.adv.length === 0) return;

    // Seleccionar el beacon con el RSSI más alto
    const beaconData = data.adv.reduce((a, b) => (a.rssi > b.rssi ? a : b));

    // Buscar el beacon en el array local
    const beacon = beacons.find((b) => b.mac === beaconData.mac);
    if (!beacon) {
      console.log("Beacon no encontrado para MAC:", beaconData.mac);
      return;
    }

    const now = new Date().toISOString();

    // Actualizar (o crear) vehículo con gateway = data.gw
    setVehicles((prevVehicles) => {
      const existingVehicle = prevVehicles.find((v) => v.gateway === data.gw);
      if (existingVehicle) {
        // Actualizar historial si cambia de beacon
        let updatedHistory = [...existingVehicle.history];
        if (
          !existingVehicle.currentBeacon ||
          existingVehicle.currentBeacon.id !== beacon.id
        ) {
          // Finalizar registro anterior
          if (existingVehicle.currentBeacon && updatedHistory.length > 0) {
            const lastRecord = updatedHistory[updatedHistory.length - 1];
            if (!lastRecord.exitTime) {
              lastRecord.exitTime = now;
              const duration =
                (new Date(now) - new Date(lastRecord.entryTime)) / 1000;
              lastRecord.duration = Math.round(duration);
            }
          }
          // Agregar nuevo registro
          updatedHistory.push({
            beaconId: beacon.id,
            beaconName: beacon.name,
            entryTime: now,
            exitTime: null,
            duration: null,
          });
        }
        // Actualizar posición
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
        // Crear vehículo nuevo
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

  // -------------------------------------------------
  // 4. MANEJO DE BEACONS (AGREGAR, EDITAR, ELIMINAR)
  // -------------------------------------------------
  const handleAddBeacon = () => {
    setBeacons((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: newBeaconName || `Beacon ${prev.length + 1}`,
        mac: newBeaconMac || "",
        x: 200,
        y: 200,
      },
    ]);
    setNewBeaconName("");
    setNewBeaconMac("");
  };

  const handleRemoveBeacon = (id) => {
    setBeacons((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBeaconPosition = (id, newX, newY) => {
    setBeacons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, x: newX, y: newY } : b))
    );
  };

  // -------------------------------------------------
  // 5. MANEJO DE ARRASTRE DE BEACONS EN PIXI
  // -------------------------------------------------
  const handlePointerDown = (event, beaconId) => {
    if (!editing) return;
    setDraggingBeaconId(beaconId);
  };

  const handlePointerMove = (event, beaconId) => {
    if (!editing) return;
    if (draggingBeaconId === beaconId) {
      const newPosition = event.data.getLocalPosition(event.target.parent);
      updateBeaconPosition(beaconId, newPosition.x, newPosition.y);
    }
  };

  const handlePointerUp = (event, beaconId) => {
    if (!editing) return;
    setDraggingBeaconId(null);
  };

  // -------------------------------------------------
  // 6. RENDERIZADO
  // -------------------------------------------------
  return (
    <div className="app-container">
      <h1 className="title">RFID Tracking System con WebSocket</h1>

      {/* Botón para alternar edición */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setEditing(!editing)}>
          {editing ? "Deshabilitar Edición" : "Habilitar Edición"}
        </button>
      </div>

      {/* Panel de control para beacons */}
      <div className="beacon-panel">
        <h2>Gestionar Beacons</h2>
        <div>
          <input
            type="text"
            placeholder="Nombre del Beacon"
            value={newBeaconName}
            onChange={(e) => setNewBeaconName(e.target.value)}
            disabled={!editing}
          />
          <input
            type="text"
            placeholder="MAC del Beacon"
            value={newBeaconMac}
            onChange={(e) => setNewBeaconMac(e.target.value)}
            disabled={!editing}
          />
          <button onClick={handleAddBeacon} disabled={!editing}>
            Agregar Beacon
          </button>
        </div>
        <table className="styled-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>MAC</th>
              <th>X</th>
              <th>Y</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {beacons.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.name}</td>
                <td>{b.mac}</td>
                <td>
                  <input
                    type="number"
                    value={b.x}
                    onChange={(e) =>
                      updateBeaconPosition(
                        b.id,
                        parseFloat(e.target.value),
                        b.y
                      )
                    }
                    disabled={!editing}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={b.y}
                    onChange={(e) =>
                      updateBeaconPosition(
                        b.id,
                        b.x,
                        parseFloat(e.target.value)
                      )
                    }
                    disabled={!editing}
                  />
                </td>
                <td>
                  <button
                    onClick={() => handleRemoveBeacon(b.id)}
                    disabled={!editing}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Escenario con PixiJS */}
      <div className="stage-container">
        <Stage width={800} height={600} options={{ backgroundColor: 0x1099bb }}>
          {/* Fondo */}
          <Sprite image="./bg.png" x={0} y={0} width={800} height={600} />

          {/* Beacons arrastrables */}
          {beacons.map((beacon) => (
            <Container
              key={beacon.id}
              x={beacon.x}
              y={beacon.y}
              interactive
              buttonMode={editing}
              pointerdown={(e) => handlePointerDown(e, beacon.id)}
              pointerup={(e) => handlePointerUp(e, beacon.id)}
              pointerupoutside={(e) => handlePointerUp(e, beacon.id)}
              pointermove={(e) => handlePointerMove(e, beacon.id)}
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

          {/* Vehículos */}
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
