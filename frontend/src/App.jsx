// ============================================================================
// ARCHIVO: src/App.jsx (Lógica Protegida e Inmutable + Rutas Ocultas Seguras)
// ============================================================================

import React, { useState, useEffect } from 'react';

// Vistas del Administrador y Personal (Privadas)
import Login from './vistas/admin/Login';
import DashboardGeneral from './vistas/admin/DashboardGeneral';

// Vista de Cocina (KDS)
import PantallaCocina from './vistas/cocina/PantallaCocina';

// Vista de Domiciliarios
import VistaDomiciliario from './vistas/domiciliario/VistaDomiciliario';

// Vistas del Cliente (Públicas)
import PantallaInicio from './vistas/cliente/PantallaInicio';
import PantallaMenu from './vistas/cliente/PantallaMenu';
import PantallaCarrito from './vistas/cliente/PantallaCarrito';
import PantallaCheckout from './vistas/cliente/PantallaCheckout';
import PantallaExito from './vistas/cliente/PantallaExito';

export default function App() {
  const [rutaActual, setRutaActual] = useState(window.location.pathname);

  const [modoPedido, setModoPedido] = useState(null);
  const [pasoCliente, setPasoCliente] = useState('inicio'); 
  const [carrito, setCarrito] = useState([]);
  const [datosUltimaOrden, setDatosUltimaOrden] = useState(null);

  // Estados de autenticación independientes por rol o una sesión general segura
  const [sesionActiva, setSesionActiva] = useState(false);
  const [rolSesion, setRolSesion] = useState(null); // 'admin', 'cocina', 'domiciliario'

  useEffect(() => {
    const manejarCambioRuta = () => setRutaActual(window.location.pathname);
    window.addEventListener('popstate', manejarCambioRuta);

    // Verificamos si hay una sesión guardada en localStorage al cargar
    const adminGuardado = localStorage.getItem('sesion_admin');
    const rolGuardado = localStorage.getItem('rol_vertizze');
    
    if (adminGuardado || rolGuardado) {
      setSesionActiva(true);
      setRolSesion(rolGuardado || 'admin');
    }

    return () => window.removeEventListener('popstate', manejarCambioRuta);
  }, []);

  const cerrarSesionGeneral = () => {
    localStorage.removeItem('sesion_admin');
    localStorage.removeItem('rol_vertizze');
    setSesionActiva(false);
    setRolSesion(null);
    // Redirige al login de la ruta administrativa o recarga limpiamente
    window.location.href = window.location.pathname;
  };

  // Manejador inmutable del carrito
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

  // ==========================================================================
  // RUTAS PRIVADAS Y OCULTAS (Requieren autenticación obligatoria)
  // ==========================================================================

  // 1. RUTA COCINA SECRETA (KDS): /kds-kchn-x98
  if (rutaActual === '/kds-kchn-x98' || rutaActual.startsWith('/kds-kchn-x98/')) {
    if (!sesionActiva || rolSesion !== 'cocina') {
      return (
        <Login 
          alIniciarSesion={() => {
            localStorage.setItem('rol_vertizze', 'cocina');
            setRolSesion('cocina');
            setSesionActiva(true);
          }} 
        />
      );
    }
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none">
        <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex justify-between items-center text-xs">
          <span className="text-emerald-400 font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Modo Cocina (KDS) Activo
          </span>
          <button 
            onClick={cerrarSesionGeneral}
            className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
        <PantallaCocina />
        <footer className="text-center text-xs text-neutral-500 py-3 mt-auto">
          Sistema Operado por <span className="font-semibold text-neutral-400">Vertizze</span> © 2026
        </footer>
      </div>
    );
  }

  // 2. RUTA DOMICILIARIOS SECRETA: /domi-dispatch-z77
  if (rutaActual === '/domi-dispatch-z77' || rutaActual.startsWith('/domi-dispatch-z77/')) {
    if (!sesionActiva) {
      return (
        <Login 
          alIniciarSesion={() => {
            localStorage.setItem('rol_vertizze', 'domiciliario');
            setRolSesion('domiciliario');
            setSesionActiva(true);
          }} 
        />
      );
    }
    return <VistaDomiciliario />;
  }

  // 3. RUTA ADMIN SECRETA: /panel-sec-v2026-adm
  if (rutaActual === '/panel-sec-v2026-adm' || rutaActual.startsWith('/panel-sec-v2026-adm/')) {
    if (!sesionActiva) {
      return (
        <Login 
          alIniciarSesion={(rolAsignado = 'admin') => {
            localStorage.setItem('sesion_admin', 'true');
            localStorage.setItem('rol_vertizze', rolAsignado);
            setRolSesion(rolAsignado);
            setSesionActiva(true);
          }} 
        />
      );
    }
    return <DashboardGeneral rolInicial={rolSesion || 'administrador'} onCerrarSesion={cerrarSesionGeneral} />;
  }

  // ==========================================================================
  // RUTA: Raíz / Cliente (Delicius Burguer) - Acceso libre sin login
  // ==========================================================================
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
