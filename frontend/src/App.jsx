// ============================================================================
// ARCHIVO: src/App.jsx (Enrutador con sesiones independientes por módulo)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';

// Vistas del Administrador y Personal (Privadas)
import Login, { CLAVES_MODULO } from './vistas/admin/Login';
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

const limpiarStorageModulo = (modulo) => {
  const claves = CLAVES_MODULO[modulo];
  if (claves) {
    localStorage.removeItem(claves.sesion);
    localStorage.removeItem(claves.rol);
    localStorage.removeItem(claves.expira);
  }
  // Limpieza residual de claves anteriores si existieran
  localStorage.removeItem('vertizze_sesion');
  localStorage.removeItem('sesion_admin');
  localStorage.removeItem('rol_vertizze');
  localStorage.removeItem('vertizze_sesion_expira');
};

const leerSesionModulo = (modulo) => {
  const claves = CLAVES_MODULO[modulo];
  if (!claves) return null;

  try {
    const rawSesion = localStorage.getItem(claves.sesion);
    const rolGuardado = localStorage.getItem(claves.rol);
    const expiraGuardado = Number(localStorage.getItem(claves.expira) || '0');

    if (!rawSesion && !rolGuardado) {
      return null;
    }

    const sesionParseada = rawSesion ? JSON.parse(rawSesion) : null;
    const expiraEn = expiraGuardado || Number(sesionParseada?.expiraEn || 0);

    if (!expiraEn || Date.now() > expiraEn) {
      limpiarStorageModulo(modulo);
      return null;
    }

    const rolRaw = (rolGuardado || sesionParseada?.rol || '').toLowerCase().trim();
    const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;

    if (!rolNormalizado) {
      limpiarStorageModulo(modulo);
      return null;
    }

    if (modulo === 'cocina' && rolNormalizado !== 'cocina') {
      return null;
    }

    if (
      modulo === 'admin' &&
      rolNormalizado !== 'administrador' &&
      rolNormalizado !== 'colaborador'
    ) {
      return null;
    }

    return { sesion: sesionParseada, rol: rolNormalizado };
  } catch {
    limpiarStorageModulo(modulo);
    return null;
  }
};

export default function App() {
  const [rutaActual, setRutaActual] = useState(window.location.pathname);

  const [modoPedido, setModoPedido] = useState(null);
  const [pasoCliente, setPasoCliente] = useState('inicio');
  const [carrito, setCarrito] = useState([]);
  const [datosUltimaOrden, setDatosUltimaOrden] = useState(null);

  const [sesionesPorModulo, setSesionesPorModulo] = useState({
    admin: null,
    cocina: null,
  });

  const sincronizarSesiones = useCallback(() => {
    setSesionesPorModulo({
      admin: leerSesionModulo('admin'),
      cocina: leerSesionModulo('cocina'),
    });
  }, []);

  useEffect(() => {
    const actualizarRuta = () => {
      setRutaActual(window.location.pathname);
      sincronizarSesiones();
    };

    window.addEventListener('popstate', actualizarRuta);
    window.addEventListener('storage', sincronizarSesiones);

    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      actualizarRuta();
    };

    sincronizarSesiones();

    return () => {
      window.removeEventListener('popstate', actualizarRuta);
      window.removeEventListener('storage', sincronizarSesiones);
      window.history.pushState = originalPushState;
    };
  }, [sincronizarSesiones]);

  const navegarA = (nuevaRuta) => {
    window.history.pushState({}, '', nuevaRuta);
    setRutaActual(nuevaRuta);
  };

  const cerrarSesionModulo = (modulo) => {
    limpiarStorageModulo(modulo);
    setSesionesPorModulo((prev) => ({
      ...prev,
      [modulo]: null,
    }));
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

  // Ruta específica de Cocina (/cocina) con sesión independiente
  if (ruta.includes('/cocina')) {
    const sesionCocina = sesionesPorModulo.cocina || leerSesionModulo('cocina');
    if (!sesionCocina) {
      return (
        <Login
          moduloInicial="cocina_form"
          alIniciarSesion={(rolAsignado = 'cocina') => {
            const rolNormalizado = rolAsignado.toLowerCase().trim() === 'cocina' ? 'cocina' : 'cocina';
            setSesionesPorModulo((prev) => ({
              ...prev,
              cocina: { sesion: { rol: rolNormalizado }, rol: rolNormalizado },
            }));
            navegarA('/cocina');
          }}
        />
      );
    }

    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none">
        <div className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex justify-between items-center text-xs">
          <span className="text-emerald-400 font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Modo Cocina (KDS) Activo — {sesionCocina.sesion?.usuario || sesionCocina.sesion?.nombre || 'Cocina'}
          </span>
          <button
            type="button"
            onClick={() => cerrarSesionModulo('cocina')}
            className="text-red-400 hover:text-red-300 font-bold cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
        <PantallaCocina />
      </div>
    );
  }

  // Ruta específica de Administración (/admin) con sesión independiente
  if (ruta.includes('/admin')) {
    const sesionAdmin = sesionesPorModulo.admin || leerSesionModulo('admin');
    if (!sesionAdmin) {
      return (
        <Login
          moduloInicial="admin_form"
          alIniciarSesion={(rolAsignado = 'administrador') => {
            const rolRaw = rolAsignado.toLowerCase().trim();
            const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;
            setSesionesPorModulo((prev) => ({
              ...prev,
              admin: { sesion: { rol: rolNormalizado }, rol: rolNormalizado },
            }));
            navegarA('/admin');
          }}
        />
      );
    }

    return (
      <DashboardGeneral
        rolInicial={sesionAdmin.rol}
        onCerrarSesion={() => cerrarSesionModulo('admin')}
      />
    );
  }

  // Selector general de acceso (/login)
  if (ruta.includes('/login')) {
    return (
      <Login
        moduloInicial="seleccion"
        alIniciarSesion={(rolAsignado = 'administrador', moduloDestino = 'admin') => {
          const rolRaw = rolAsignado.toLowerCase().trim();
          const rolNormalizado = rolRaw === 'admin' ? 'administrador' : rolRaw;
          const esCocina = moduloDestino === 'cocina' || rolNormalizado === 'cocina';

          setSesionesPorModulo((prev) => ({
            ...prev,
            [esCocina ? 'cocina' : 'admin']: {
              sesion: { rol: esCocina ? 'cocina' : rolNormalizado },
              rol: esCocina ? 'cocina' : rolNormalizado,
            },
          }));

          navegarA(esCocina ? '/cocina' : '/admin');
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
