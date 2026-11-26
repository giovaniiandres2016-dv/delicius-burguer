// ============================================================================
// ARCHIVO: src/App.jsx (Enrutador Seguro y Limpio para Vértizze)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

// Vistas del Administrador y Personal (Privadas)
import Login from './vistas/admin/Login';
import DashboardGeneral from './vistas/admin/DashboardGeneral';

// Vista de Cocina (KDS)
import PantallaCocina from './vistas/cocina/PantallaCocina';

// Vista de Domiciliarios (Multiusuario con sesión propia por PIN)
import VistaDomiciliario from './vistas/domiciliario/VistaDomiciliario';

// Vistas del Cliente (Públicas)
import PantallaInicio from './vistas/cliente/PantallaInicio';
import PantallaMenu from './vistas/cliente/PantallaMenu';
import PantallaCarrito from './vistas/cliente/PantallaCarrito';
import PantallaCheckout from './vistas/cliente/PantallaCheckout';
import PantallaExito from './vistas/cliente/PantallaExito';

const limpiarStorageSesion = () => {
  localStorage.removeItem('vertizze_sesion');
  localStorage.removeItem('sesion_admin');
  localStorage.removeItem('rol_vertizze');
  localStorage.removeItem('vertizze_sesion_expira');
};

const leerSesionValida = () => {
  try {
    const rawSesion = localStorage.getItem('vertizze_sesion');
    const rolGuardado = localStorage.getItem('rol_vertizze');
    const expiraGuardado = Number(localStorage.getItem('vertizze_sesion_expira') || '0');

    if (!rawSesion && !rolGuardado) {
      return null;
    }

    const sesionParseada = rawSesion ? JSON.parse(rawSesion) : null;
    const expiraEn = expiraGuardado || Number(sesionParseada?.expiraEn || 0);

    if (!expiraEn || Date.now() > expiraEn) {
      limpiarStorageSesion();
      return null;
    }

    const rolRaw = (rolGuardado || sesionParseada?.rol || '').toLowerCase().trim();
    const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;

    if (!rolNormalizado) {
      limpiarStorageSesion();
      return null;
    }

    return { sesion: sesionParseada, rol: rolNormalizado };
  } catch {
    limpiarStorageSesion();
    return null;
  }
};

export default function App() {
  const [rutaActual, setRutaActual] = useState(window.location.pathname);

  const [modoPedido, setModoPedido] = useState(null);
  const [pasoCliente, setPasoCliente] = useState('inicio');
  const [carrito, setCarrito] = useState([]);
  const [datosUltimaOrden, setDatosUltimaOrden] = useState(null);

  const [sesionActiva, setSesionActiva] = useState(false);
  const [rolSesion, setRolSesion] = useState(null); // 'administrador', 'cocina', 'colaborador'

  const sincronizarSesionDesdeStorage = useCallback(() => {
    const sesionValida = leerSesionValida();
    if (sesionValida) {
      setSesionActiva(true);
      setRolSesion(sesionValida.rol);
    } else {
      setSesionActiva(false);
      setRolSesion(null);
    }
  }, []);

  useEffect(() => {
    const actualizarRuta = () => {
      setRutaActual(window.location.pathname);
      sincronizarSesionDesdeStorage();
    };

    window.addEventListener('popstate', actualizarRuta);
    window.addEventListener('storage', sincronizarSesionDesdeStorage);

    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      actualizarRuta();
    };

    sincronizarSesionDesdeStorage();

    return () => {
      window.removeEventListener('popstate', actualizarRuta);
      window.removeEventListener('storage', sincronizarSesionDesdeStorage);
      window.history.pushState = originalPushState;
    };
  }, [sincronizarSesionDesdeStorage]);

  const navegarA = (nuevaRuta) => {
    window.history.pushState({}, '', nuevaRuta);
    setRutaActual(nuevaRuta);
  };

  const cerrarSesionGeneral = () => {
    limpiarStorageSesion();
    setSesionActiva(false);
    setRolSesion(null);
    navegarA('/login');
  };

  const manejarAgregarAlCarrito = (producto) => {
    setCarrito((carritoActual) => {
      const existe = carritoActual.some((item) => item.id === producto.id);
      if (existe) {
        return carritoActual.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
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
    setCarrito((carritoActual) =>
      carritoActual.map((item) =>
        item.id === idProducto ? { ...item, cantidad: nuevaCantidad } : item
      )
    );
  };

  const manejarActualizarObservacionItem = (idProducto, nuevaObservacion) => {
    setCarrito((carritoActual) =>
      carritoActual.map((item) =>
        item.id === idProducto ? { ...item, observacion: nuevaObservacion } : item
      )
    );
  };

  const manejarEliminarItem = (idProducto) => {
    setCarrito((carritoActual) => carritoActual.filter((item) => item.id !== idProducto));
  };

  const manejarVolverInicioCliente = () => {
    setDatosUltimaOrden(null);
    setCarrito([]);
    setModoPedido(null);
    setPasoCliente('inicio');
  };

  // ==========================================================================
  // ENRUTAMIENTO POR URL (Domiciliario / Administración / Cocina / Login)
  // ==========================================================================
  const ruta = (rutaActual || window.location.pathname).toLowerCase();

  // Vista independiente de Domiciliarios (/domiciliario)
  if (ruta.includes('/domiciliario')) {
    return <VistaDomiciliario />;
  }

  if (ruta.includes('/admin') || ruta.includes('/cocina') || ruta.includes('/login')) {
    if (!sesionActiva || !rolSesion) {
      return (
        <Login
          alIniciarSesion={(rolAsignado = 'administrador') => {
            const rolRaw = rolAsignado.toLowerCase().trim();
            const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;
            localStorage.setItem('rol_vertizze', rolNormalizado);
            setRolSesion(rolNormalizado);
            setSesionActiva(true);

            if (rolNormalizado === 'cocina') {
              navegarA('/cocina');
            } else if (rolNormalizado === 'administrador' || rolNormalizado === 'colaborador') {
              navegarA('/admin');
            }
          }}
        />
      );
    }

    if (rolSesion === 'cocina') {
      return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none">
          <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex justify-between items-center text-xs">
            <span className="text-emerald-400 font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Modo Cocina (KDS) Activo
            </span>
            <button
              type="button"
              onClick={cerrarSesionGeneral}
              className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
          <PantallaCocina />
        </div>
      );
    }

    if (rolSesion === 'administrador' || rolSesion === 'colaborador') {
      return <DashboardGeneral rolInicial={rolSesion} onCerrarSesion={cerrarSesionGeneral} />;
    }

    return (
      <Login
        alIniciarSesion={(rolAsignado = 'administrador') => {
          const rolRaw = rolAsignado.toLowerCase().trim();
          const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;
          localStorage.setItem('rol_vertizze', rolNormalizado);
          setRolSesion(rolNormalizado);
          setSesionActiva(true);
          navegarA(rolNormalizado === 'cocina' ? '/cocina' : '/admin');
        }}
      />
    );
  }

  // ==========================================================================
  // RUTA PREDETERMINADA / PÚBLICA (Lo que ve el Cliente en la raíz "/")
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
          alConfirmarPedido={(orden) => {
            setDatosUltimaOrden(orden);
            setCarrito([]);
            setPasoCliente('exito');
          }}
        />
      )}
      {pasoCliente === 'exito' && (
        <PantallaExito datosOrden={datosUltimaOrden} alVolverInicio={manejarVolverInicioCliente} />
      )}
    </div>
  );
}
