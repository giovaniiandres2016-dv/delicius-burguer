// ============================================================================
// ARCHIVO: src/App.jsx (Lógica de Carrito Protegida e Inmutable)
// ============================================================================

import React, { useState, useEffect } from 'react';

// Vistas del Administrador y Personal (Privadas)
import Login from './vistas/admin/Login';
import DashboardGeneral from './vistas/admin/DashboardGeneral';

// Vista de Cocina (KDS) movida a su propia carpeta
import PantallaCocina from './vistas/cocina/PantallaCocina';

// Vista de Domiciliarios
import VistaDomiciliario from './vistas/domiciliario/VistaDomiciliario';

// Vistas del Cliente (Públicas)
import PantallaInicio from './vistas/cliente/PantallaInicio';
import PantallaMenu from './vistas/cliente/PantallaMenu';
import PantallaCarrito from './vistas/cliente/PantallaCarrito';
import PantallaCheckout from './vistas/cliente/PantallaCheckout';
import PantallaExito from './vistas/cliente/PantallaExito';

import { crearOrden } from './sdk/vertizzeApi';

export default function App() {
  const [rutaActual, setRutaActual] = useState(window.location.pathname);
  
  const [modoPedido, setModoPedido] = useState(null);
  const [pasoCliente, setPasoCliente] = useState('inicio'); 
  const [carrito, setCarrito] = useState([]);
  const [datosUltimaOrden, setDatosUltimaOrden] = useState(null);

  const [rolActual, setRolActual] = useState(null); 

  useEffect(() => {
    const manejarCambioRuta = () => setRutaActual(window.location.pathname);
    window.addEventListener('popstate', manejarCambioRuta);

    const sesionAdmin = localStorage.getItem('sesion_admin');
    if (sesionAdmin) {
      setRolActual('admin');
    }

    return () => window.removeEventListener('popstate', manejarCambioRuta);
  }, []);

  const cerrarSesionAdmin = () => {
    localStorage.removeItem('sesion_admin');
    setRolActual(null);
  };

  // Manejador inmutable: garantiza sumar estrictamente +1
  const manejarAgregarAlCarrito = (producto) => {
    setCarrito((carritoActual) => {
      const existe = carritoActual.some(item => item.id === producto.id);
      if (existe) {
        return carritoActual.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...carritoActual, { ...producto, cantidad: 1, observacion: '' }];
    });
  };

  const manejarActualizarCantidad = (idProducto, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      manejarEliminarItem(idProducto);
      return;
    }
    setCarrito(carritoActual => 
      carritoActual.map(item => 
        item.id === idProducto ? { ...item, cantidad: nuevaCantidad } : item
      )
    );
  };

  const manejarActualizarObservacionItem = (idProducto, nuevaObservacion) => {
    setCarrito(carritoActual => 
      carritoActual.map(item => 
        item.id === idProducto ? { ...item, observacion: nuevaObservacion } : item
      )
    );
  };

  const manejarEliminarItem = (idProducto) => {
    setCarrito(carritoActual => carritoActual.filter(item => item.id !== idProducto));
  };

  const manejarVolverInicioCliente = () => {
    setDatosUltimaOrden(null);
    setCarrito([]);
    setModoPedido(null);
    setPasoCliente('inicio');
  };

  // RUTA: /cocina
  if (rutaActual.includes('/cocina')) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none">
        <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex justify-between items-center text-xs">
          <span className="text-emerald-400 font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Modo Cocina (KDS) Activo
          </span>
          <span className="text-neutral-400">Pantalla fija de preparación en tiempo real</span>
        </div>
        <PantallaCocina />
        <footer className="text-center text-xs text-neutral-500 py-3 mt-auto">
          Sistema Operado por <span className="font-semibold text-neutral-400">Vertizze</span> © 2026[cite: 16]
        </footer>
      </div>
    );
  }

  // RUTA: /domiciliario
  if (rutaActual.includes('/domiciliario')) {
    return <VistaDomiciliario />;
  }

  // RUTA: /admin
  if (rutaActual.includes('/admin')) {
    if (!rolActual) {
      return (
        <Login 
          alIniciarSesion={() => {
            setRolActual('admin');
          }} 
        />
      );
    }

    // Se eliminó la barra superior y el pie de página para que el Dashboard ocupe toda la vista
    return <DashboardGeneral />;
  }

  // RUTA: Raíz / Cliente (Delicius Burguer)
  return (
    <div className="relative min-h-screen bg-neutral-950 text-white">
      {pasoCliente === 'inicio' && (
        <PantallaInicio 
          alSeleccionarModo={(modo) => {
            setModoPedido(modo);
            setPasoCliente('menu');
          }}
        />
      )}

      {pasoCliente === 'menu' && (
        <PantallaMenu 
          modoPedido={modoPedido}
          alVolverInicio={manejarVolverInicioCliente}
          alIrAlCarrito={() => setPasoCliente('carrito')}
          carrito={carrito}
          alAgregarAlCarrito={manejarAgregarAlCarrito}
        />
      )}

      {pasoCliente === 'carrito' && (
        <PantallaCarrito 
          carrito={carrito}
          modoPedido={modoPedido}
          alVolverAlMenu={() => setPasoCliente('menu')}
          alActualizarCantidad={manejarActualizarCantidad}
          alActualizarObservacion={manejarActualizarObservacionItem}
          alEliminarItem={manejarEliminarItem}
          alIrAlCheckout={() => setPasoCliente('checkout')}  
        />
      )}

      {pasoCliente === 'checkout' && (
        <PantallaCheckout 
          carrito={carrito}
          modoPedido={modoPedido}
          alVolverAlCarrito={() => setPasoCliente('carrito')}
          alConfirmarPedido={(ordenCreada) => {
            setDatosUltimaOrden(ordenCreada);
            setCarrito([]);
            setPasoCliente('exito');
          }}
        />
      )}

      {pasoCliente === 'exito' && (
        <PantallaExito 
          datosOrden={datosUltimaOrden}
          alVolverInicio={manejarVolverInicioCliente}
        />
      )}
    </div>
  );
}