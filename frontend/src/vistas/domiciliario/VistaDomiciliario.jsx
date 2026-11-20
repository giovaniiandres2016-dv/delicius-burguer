// ============================================================================
// ARCHIVO: src/vistas/domiciliario/VistaDomiciliario.jsx
// DESCRIPCIÓN: Panel KDS Domiciliarios multiusuario con sesión por PIN,
//              desglose Pedido / Domicilio / Total por zona, alerta de NO PAGO,
//              historial filtrable por fecha (por defecto hoy) y Realtime.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Truck, Key, LogOut, CheckCircle, Clock, MapPin,
  Phone, AlertCircle, RefreshCw, Navigation, History, Bell, Calendar
} from 'lucide-react';
import { supabase } from '../../sdk/vertizzeApi';

const CLAVE_SESION_DOMI = 'vertizze_domi_sesion';

const obtenerFechaLocalISO = (fechaInput = new Date()) => {
  const d = fechaInput instanceof Date ? fechaInput : new Date(fechaInput);
  if (Number.isNaN(d.getTime())) return '';
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
};

const extraerFechaOrdenISO = (orden) => {
  const raw =
    orden.fecha_entrega ||
    orden.entregado_en ||
    orden.created_at ||
    orden.fecha_creacion ||
    orden.fecha;
  if (!raw) return obtenerFechaLocalISO();
  const str = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? '' : obtenerFechaLocalISO(parsed);
};

const esOrdenPagada = (orden) => {
  if (orden.pagado === true || orden.esta_pagado === true) return true;
  const estadoPago = String(
    orden.estado_pago ?? orden.pago_estado ?? orden.estadoPago ?? ''
  )
    .trim()
    .toLowerCase();
  if (['pagado', 'pago', 'paid', 'cancelado', 'aprobado'].includes(estadoPago)) {
    return true;
  }
  if (['por pagar', 'no pago', 'pendiente', 'contraentrega', 'efectivo'].includes(estadoPago)) {
    return false;
  }
  return false;
};

const calcularMontosOrden = (orden) => {
  const valorDomicilio = Number(
    orden.costo_domicilio ??
      orden.tarifa_domicilio ??
      orden.valor_domicilio ??
      orden.domicilio ??
      orden.envio ??
      orden.valor_envio ??
      0
  ) || 0;

  const totalGuardado = Number(orden.total ?? 0) || 0;
  const subtotalGuardado = Number(orden.subtotal ?? 0) || 0;

  let valorPedido = subtotalGuardado;
  if (!valorPedido && totalGuardado > 0) {
    valorPedido = Math.max(0, totalGuardado - valorDomicilio);
  }

  const totalOrden = totalGuardado > 0 ? totalGuardado : valorPedido + valorDomicilio;
  const pagada = esOrdenPagada(orden);
  const aCobrar = pagada ? 0 : totalOrden;

  return {
    valorPedido,
    valorDomicilio,
    totalOrden,
    pagada,
    aCobrar,
  };
};

export default function VistaDomiciliario() {
  // Estados de Autenticación
  const [pinIngresado, setPinIngresado] = useState('');
  const [domiciliario, setDomiciliario] = useState(null);
  const [errorLogin, setErrorLogin] = useState('');
  const [cargandoLogin, setCargandoLogin] = useState(false);

  // Estados de Pedidos y Pestañas
  const [ordenesAsignadas, setOrdenesAsignadas] = useState([]);
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
  const [pestaña, setPestaña] = useState('activos');
  const [sonidoHabilitado, setSonidoHabilitado] = useState(false);

  // Filtro de fecha en historial (por defecto HOY)
  const hoyISO = obtenerFechaLocalISO();
  const [fechaHistorial, setFechaHistorial] = useState(hoyISO);
  const [mostrarTodoHistorial, setMostrarTodoHistorial] = useState(false);

  // Ref para contar las órdenes anteriores y detectar las entrantes
  const conteoOrdenesPrevio = useRef(0);

  const alertarNuevoDomicilio = () => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (e) {
        console.log('Vibración bloqueada:', e);
      }
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.log('Audio bloqueado o no soportado:', e);
    }
  };

  const habilitarSonidoInicial = () => {
    alertarNuevoDomicilio();
    setSonidoHabilitado(true);
  };

  const capitalizarTexto = (texto) => {
    if (!texto) return '';
    const str = String(texto).trim();
    if (str === '') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const limpiarTelefono = (tel) => {
    if (!tel) return '';
    let limpio = String(tel).trim().replace(/\D/g, '');
    if (limpio.startsWith('57') && limpio.length > 10) {
      limpio = limpio.substring(2);
    }
    return limpio;
  };

  const formatearItems = (itemsRaw) => {
    if (!itemsRaw) return 'Sin detalle';
    let items = itemsRaw;
    if (typeof itemsRaw === 'string') {
      try {
        items = JSON.parse(itemsRaw);
      } catch (e) {
        return itemsRaw;
      }
    }
    if (Array.isArray(items)) {
      return items
        .map((item) => {
          const cant = item.cantidad || item.stock || 1;
          const nombre = capitalizarTexto(
            item.nombre || item.producto || item.descripcion || 'Artículo'
          );
          const obs = item.observacion ? ` (${item.observacion})` : '';
          return `${cant}x ${nombre}${obs}`;
        })
        .join(', ');
    }
    return String(itemsRaw);
  };

  useEffect(() => {
    const domiGuardado = localStorage.getItem(CLAVE_SESION_DOMI);
    if (domiGuardado) {
      try {
        const datos = JSON.parse(domiGuardado);
        if (datos && datos.id) {
          setDomiciliario(datos);
          sincronizarEstadoDomi(datos.id, 'disponible');
        }
      } catch (e) {
        localStorage.removeItem(CLAVE_SESION_DOMI);
      }
    }
  }, []);

  useEffect(() => {
    if (!domiciliario) return;

    conteoOrdenesPrevio.current = 0;
    cargarOrdenesDomiciliario();

    const canalRealtime = supabase
      .channel(`kds-domi-realtime-${domiciliario.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes' },
        () => {
          cargarOrdenesDomiciliario();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, [domiciliario?.id]);

  const sincronizarEstadoDomi = async (domiId, nuevoEstado) => {
    try {
      await supabase
        .from('domiciliarios')
        .update({ estado: nuevoEstado })
        .eq('id', domiId);
    } catch (err) {
      console.error('Error al actualizar estado:', err.message);
    }
  };

  const manejarLogin = async (e) => {
    e.preventDefault();
    setErrorLogin('');

    if (!pinIngresado || pinIngresado.trim().length < 4) {
      setErrorLogin('Ingresa un PIN válido de al menos 4 dígitos.');
      return;
    }

    setCargandoLogin(true);
    try {
      const { data, error } = await supabase
        .from('domiciliarios')
        .select('*')
        .eq('pin_acceso', pinIngresado.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorLogin('PIN incorrecto.');
        setCargandoLogin(false);
        return;
      }

      localStorage.setItem(CLAVE_SESION_DOMI, JSON.stringify(data));
      setDomiciliario(data);
      setPinIngresado('');
      await sincronizarEstadoDomi(data.id, 'disponible');
    } catch (err) {
      console.error('Error login:', err.message);
      setErrorLogin('Error de conexión.');
    } finally {
      setCargandoLogin(false);
    }
  };

  const cerrarSesion = async () => {
    if (window.confirm('¿Deseas salir de tu turno como domiciliario?')) {
      if (domiciliario) {
        await sincronizarEstadoDomi(domiciliario.id, 'fuera de turno');
      }
      localStorage.removeItem(CLAVE_SESION_DOMI);
      setDomiciliario(null);
      setOrdenesAsignadas([]);
      setPinIngresado('');
      conteoOrdenesPrevio.current = 0;
    }
  };

  const cargarOrdenesDomiciliario = async () => {
    if (!domiciliario) return;
    setCargandoOrdenes(true);
    try {
      const { data, error } = await supabase
        .from('ordenes')
        .select('*')
        .eq('domiciliario_id', domiciliario.id)
        .order('id', { ascending: false });

      if (error) throw error;
      const ordenesNuevas = data || [];

      const activasNuevas = ordenesNuevas.filter((o) => o.estado_domicilio !== 'entregado');
      if (activasNuevas.length > conteoOrdenesPrevio.current && conteoOrdenesPrevio.current !== 0) {
        alertarNuevoDomicilio();
      }
      conteoOrdenesPrevio.current = activasNuevas.length;

      setOrdenesAsignadas(ordenesNuevas);
    } catch (err) {
      console.error('Error al cargar órdenes:', err.message);
    } finally {
      setCargandoOrdenes(false);
    }
  };

  const actualizarEstadoPedido = async (ordenId, nuevoEstadoDomicilio) => {
    try {
      const updateData = { estado_domicilio: nuevoEstadoDomicilio };
      if (nuevoEstadoDomicilio === 'entregado') {
        updateData.estado = 'Entregado';
      }

      const { error } = await supabase
        .from('ordenes')
        .update(updateData)
        .eq('id', ordenId);

      if (error) throw error;

      const pendientesRestantes = ordenesAsignadas.filter(
        (o) => o.id !== ordenId && o.estado_domicilio !== 'entregado'
      ).length;

      const nuevoEstadoDomi = pendientesRestantes > 0 ? 'en ruta' : 'disponible';
      await sincronizarEstadoDomi(domiciliario.id, nuevoEstadoDomi);

      cargarOrdenesDomiciliario();
    } catch (err) {
      console.error('Error al actualizar pedido:', err.message);
      alert('No se pudo actualizar el pedido: ' + err.message);
    }
  };

  const pedidosActivos = ordenesAsignadas.filter((o) => o.estado_domicilio !== 'entregado');
  const todosEntregados = ordenesAsignadas.filter((o) => o.estado_domicilio === 'entregado');

  const historialFiltrado = mostrarTodoHistorial
    ? todosEntregados
    : todosEntregados.filter((ord) => extraerFechaOrdenISO(ord) === fechaHistorial);

  const totalDomiciliosHistorial = historialFiltrado.reduce(
    (acc, ord) => acc + calcularMontosOrden(ord).valorDomicilio,
    0
  );

  // Formulario Login por PIN
  if (!domiciliario) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 font-sans select-none">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-amber-600"></div>

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center mx-auto text-neutral-950 shadow-lg shadow-amber-500/20">
              <Truck className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-black tracking-wider text-white">VÉRTIZZE DOMICILIOS</h1>
            <p className="text-xs text-neutral-400">Ingreso exclusivo para repartidores</p>
          </div>

          <form onSubmit={manejarLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5 text-center">
                Ingresa tu PIN Secreto
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="8"
                  placeholder="••••"
                  value={pinIngresado}
                  onChange={(e) => setPinIngresado(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl pl-10 pr-4 py-3 text-center text-lg font-mono font-black text-amber-400 tracking-widest focus:outline-none focus:border-amber-500 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {errorLogin && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorLogin}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={cargandoLogin}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2"
            >
              {cargandoLogin ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Entrar a Turno'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans select-none">
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/20">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider text-white">
              {capitalizarTexto(domiciliario.nombre)}
            </h1>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              En Turno • {capitalizarTexto(domiciliario.estado || 'Disponible')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!sonidoHabilitado && (
            <button
              onClick={habilitarSonidoInicial}
              className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Activar Sonido y Vibración"
            >
              <Bell className="w-4 h-4 animate-bounce" /> Activar Alerta
            </button>
          )}

          <button
            onClick={cerrarSesion}
            title="Salir de turno"
            className="p-2 bg-neutral-950 hover:bg-red-500/10 border border-neutral-800 hover:border-red-500/30 text-neutral-400 hover:text-red-400 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Métricas */}
      <div className="p-3 bg-neutral-900/60 border-b border-neutral-800/80 grid grid-cols-3 gap-2 text-center">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5">
          <span className="text-[9px] text-neutral-400 font-bold uppercase block">Por Entregar</span>
          <p className="text-sm font-black text-amber-400 mt-0.5">{pedidosActivos.length}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5">
          <span className="text-[9px] text-neutral-400 font-bold uppercase block">
            Entregados ({mostrarTodoHistorial ? 'Todos' : fechaHistorial === hoyISO ? 'Hoy' : fechaHistorial})
          </span>
          <p className="text-sm font-black text-emerald-400 mt-0.5">{historialFiltrado.length}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5">
          <span className="text-[9px] text-neutral-400 font-bold uppercase block">Domicilios Zonas</span>
          <p className="text-sm font-black text-white mt-0.5">
            $ {totalDomiciliosHistorial.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Pestañas */}
      <div className="px-3 pt-3 flex gap-2">
        <button
          onClick={() => setPestaña('activos')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            pestaña === 'activos'
              ? 'bg-amber-500 text-neutral-950 shadow-md'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Servicios Activos ({pedidosActivos.length})</span>
        </button>

        <button
          onClick={() => setPestaña('historial')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            pestaña === 'historial'
              ? 'bg-amber-500 text-neutral-950 shadow-md'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Historial ({historialFiltrado.length})</span>
        </button>
      </div>

      {/* Lista de Servicios */}
      <main className="flex-1 p-3 space-y-3 overflow-y-auto">
        {cargandoOrdenes ? (
          <div className="py-20 text-center text-neutral-500 text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
            <p>Sincronizando entregas...</p>
          </div>
        ) : pestaña === 'activos' ? (
          pedidosActivos.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-3 shadow-lg my-auto">
              <div className="w-12 h-12 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-center mx-auto text-amber-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-white">Sin domicilios pendientes</h3>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Mantén la aplicación abierta. Apenas el restaurante te asigne un pedido, aparecerá en esta pantalla en tiempo real.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosActivos.map((orden) => {
                const telClienteLimpio = limpiarTelefono(orden.cliente_telefono || orden.telefono);
                const direccionStr =
                  orden.ubicacion_detalle ||
                  orden.direccion ||
                  orden.cliente_direccion ||
                  'Dirección no especificada';
                const zonaStr = orden.zona || orden.barrio || orden.sector || '';
                const estadoDomi = (orden.estado_domicilio || 'asignado').toLowerCase();
                const { valorPedido, valorDomicilio, totalOrden, pagada, aCobrar } =
                  calcularMontosOrden(orden);

                return (
                  <div
                    key={orden.id}
                    className={`bg-neutral-900 rounded-3xl p-4 space-y-3 relative overflow-hidden shadow-xl border ${
                      !pagada ? 'border-red-500/70' : 'border-amber-500/40'
                    }`}
                  >
                    <div
                      className={`absolute top-0 inset-x-0 h-1.5 ${
                        !pagada
                          ? 'bg-gradient-to-r from-red-500 to-amber-500'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600'
                      }`}
                    ></div>

                    {/* Banner de Estado de Pago */}
                    {!pagada ? (
                      <div className="bg-red-500/15 border border-red-500/50 rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                          NO VA PAGO — COBRAR EN ENTREGA
                        </span>
                        <span className="text-xs font-black text-white bg-red-600 px-2.5 py-0.5 rounded-lg">
                          $ {aCobrar.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          PEDIDO YA PAGADO
                        </span>
                        <span className="text-[11px] font-bold text-emerald-300">
                          Cobro al cliente: $ 0
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            Orden #{orden.numero_orden || orden.id}
                          </span>
                          {zonaStr && (
                            <span className="px-2 py-1 bg-neutral-800 text-neutral-200 rounded-lg text-[10px] font-bold">
                              Zona: {capitalizarTexto(zonaStr)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-black text-white mt-1.5">
                          {capitalizarTexto(orden.cliente_nombre) || 'Cliente General'}
                        </h3>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-neutral-400 font-bold block">
                          {pagada ? 'Total Orden (Paga)' : 'Total a Cobrar'}
                        </span>
                        <p
                          className={`text-base font-black ${
                            !pagada ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          $ {(pagada ? totalOrden : aCobrar).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Desglose claro: Pedido + Domicilio + Total */}
                    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-neutral-300">
                        <span>Valor del pedido:</span>
                        <span className="font-bold text-white">
                          $ {valorPedido.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-neutral-300">
                        <span>Valor del domicilio:</span>
                        <span className="font-bold text-amber-400">
                          $ {valorDomicilio.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t border-neutral-800 pt-1.5 flex justify-between items-center font-black">
                        <span className="text-white">
                          {pagada ? 'Total orden (ya pagada):' : 'Total a cobrar al cliente:'}
                        </span>
                        <span
                          className={`text-sm ${
                            !pagada ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          $ {(pagada ? totalOrden : aCobrar).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                            Dirección de Entrega:
                          </span>
                          <p className="text-xs font-bold text-white leading-relaxed">
                            {capitalizarTexto(direccionStr)}
                          </p>
                        </div>
                      </div>

                      {direccionStr && direccionStr !== 'Dirección no especificada' && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            direccionStr
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Abrir Mapa / GPS
                        </a>
                      )}
                    </div>

                    {telClienteLimpio && (
                      <div className="flex gap-2">
                        <a
                          href={`tel:${telClienteLimpio}`}
                          className="flex-1 py-2 bg-neutral-950 border border-neutral-800 text-emerald-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5" /> Llamar Cliente
                        </a>
                        <a
                          href={`https://wa.me/57${telClienteLimpio}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-neutral-950 border border-neutral-800 text-emerald-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          💬 WhatsApp
                        </a>
                      </div>
                    )}

                    <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-2.5 space-y-1">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                        Contenido del Pedido:
                      </span>
                      <p className="text-xs text-neutral-300">{formatearItems(orden.items)}</p>
                    </div>

                    <div className="pt-1 flex gap-2">
                      {estadoDomi !== 'en_ruta' && estadoDomi !== 'en ruta' ? (
                        <button
                          onClick={() => actualizarEstadoPedido(orden.id, 'en_ruta')}
                          className="w-full py-3 bg-amber-500 text-neutral-950 font-black rounded-2xl text-xs uppercase cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Truck className="w-4 h-4" /> Iniciar Recorrido (En Ruta)
                        </button>
                      ) : (
                        <button
                          onClick={() => actualizarEstadoPedido(orden.id, 'entregado')}
                          className="w-full py-3 bg-emerald-500 text-neutral-950 font-black rounded-2xl text-xs uppercase cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Confirmar Entrega Realizada
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {/* Barra de filtro por fecha en historial */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="date"
                  value={fechaHistorial}
                  disabled={mostrarTodoHistorial}
                  onChange={(e) => {
                    setMostrarTodoHistorial(false);
                    setFechaHistorial(e.target.value || hoyISO);
                  }}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarTodoHistorial(false);
                    setFechaHistorial(hoyISO);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    !mostrarTodoHistorial && fechaHistorial === hoyISO
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-300'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarTodoHistorial((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    mostrarTodoHistorial
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-300'
                  }`}
                >
                  {mostrarTodoHistorial ? 'Por Fecha' : 'Ver Todo'}
                </button>
              </div>
            </div>

            {historialFiltrado.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center text-xs text-neutral-400">
                No hay domicilios entregados para la fecha seleccionada.
              </div>
            ) : (
              historialFiltrado.map((ord) => {
                const { valorPedido, valorDomicilio, totalOrden, pagada } = calcularMontosOrden(ord);
                return (
                  <div
                    key={ord.id}
                    className={`bg-neutral-900 rounded-2xl p-3 flex justify-between items-center gap-3 border ${
                      !pagada ? 'border-red-500/40' : 'border-neutral-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-amber-400">
                          Orden #{ord.numero_orden || ord.id}
                        </span>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            pagada
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {pagada ? 'PAGADO' : 'NO VA PAGO'}
                        </span>
                      </div>
                      <p className="text-xs text-white font-semibold">
                        {capitalizarTexto(ord.cliente_nombre) || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Pedido: $ {valorPedido.toLocaleString()} • Domi: $ {valorDomicilio.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-amber-400 font-bold block">
                        Domi: $ {valorDomicilio.toLocaleString()}
                      </span>
                      <p className="text-xs font-black text-white">
                        Total: $ {totalOrden.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
