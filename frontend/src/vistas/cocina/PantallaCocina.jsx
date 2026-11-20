// ============================================================================
// ARCHIVO: src/vistas/cocina/PantallaCocina.jsx
// DESCRIPCIÓN: KDS optimizado en tiempo real y totalmente responsivo para Delicius Burguer.
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { Clock, ChefHat, Bell, UtensilsCrossed, Bike, Store, Printer, Sparkles, X } from 'lucide-react';
import { supabase } from '../../sdk/supabaseClient';
import { asignarDomiciliarioAlCompletarCocina } from '../../sdk/vertizzeApi';

const ESTADOS_ACTIVOS_COCINA = new Set(['pendiente', 'en_proceso', 'en proceso']);
const ESTADOS_CANCELADOS = new Set(['cancelada', 'cancelado', 'anulada', 'anulado']);

function parsearItemsSeguros(itemsRaw) {
  if (!itemsRaw) return [];
  if (Array.isArray(itemsRaw)) return itemsRaw;
  if (typeof itemsRaw === 'string') {
    try {
      const parsed = JSON.parse(itemsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizarItemParaComparar(item, index) {
  const cantidad = Number(item?.cantidad || 1);
  const nombre = String(item?.nombre || item?.titulo || item?.producto || 'Artículo').trim();
  const observacion = String(item?.observacion || item?.nota || '').trim();
  const clave = item?.id != null ? `id:${String(item.id)}` : `idx:${index}:${nombre.toLowerCase()}`;
  return { clave, cantidad, nombre, observacion };
}

function detectarCambiosEnOrden(ordenAnterior, ordenNueva) {
  const itemsPrev = parsearItemsSeguros(ordenAnterior?.items);
  const itemsNext = parsearItemsSeguros(ordenNueva?.items);

  const mapaPrev = new Map();
  itemsPrev.forEach((it, idx) => {
    const norm = normalizarItemParaComparar(it, idx);
    mapaPrev.set(norm.clave, norm);
  });

  const mapaNext = new Map();
  const cambiosPorIndice = {};
  let huboCambioEnItems = false;

  itemsNext.forEach((it, idx) => {
    const norm = normalizarItemParaComparar(it, idx);
    mapaNext.set(norm.clave, norm);
    const prev = mapaPrev.get(norm.clave);

    if (!prev) {
      cambiosPorIndice[idx] = { esNuevo: true, cantidadCambio: false, notaCambio: false };
      huboCambioEnItems = true;
    } else {
      const cantidadCambio = prev.cantidad !== norm.cantidad;
      const notaCambio = prev.observacion !== norm.observacion;
      const nombreCambio = prev.nombre.toLowerCase() !== norm.nombre.toLowerCase();
      if (cantidadCambio || notaCambio || nombreCambio) {
        cambiosPorIndice[idx] = {
          esNuevo: nombreCambio,
          cantidadCambio,
          notaCambio
        };
        huboCambioEnItems = true;
      }
    }
  });

  const itemsEliminados = [];
  mapaPrev.forEach((prevItem, clave) => {
    if (!mapaNext.has(clave)) {
      itemsEliminados.push(prevItem);
      huboCambioEnItems = true;
    }
  });

  if (itemsPrev.length !== itemsNext.length) {
    huboCambioEnItems = true;
  }

  const camposDetalle = [
    'cliente_nombre',
    'metodo_pago',
    'estado_pago',
    'tipo_servicio',
    'mesa',
    'numero_mesa',
    'mesa_id',
    'direccion',
    'ubicacion_detalle'
  ];

  const huboCambioEnDetalle = camposDetalle.some(
    (campo) => JSON.stringify(ordenAnterior?.[campo] ?? null) !== JSON.stringify(ordenNueva?.[campo] ?? null)
  );

  return {
    modificada: huboCambioEnItems || huboCambioEnDetalle,
    cambiosPorIndice,
    itemsEliminados,
    actualizadaEn: Date.now()
  };
}

export default function PantallaCocina() {
  const [ordenes, setOrdenes] = useState([]);
  const [coberturaZonas, setCoberturaZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ordenModificadaInfo, setOrdenModificadaInfo] = useState({});
  const [ordenesCanceladas, setOrdenesCanceladas] = useState([]);
  const [ordenImprimiendo, setOrdenImprimiendo] = useState(null);
  const [audioHabilitado, setAudioHabilitado] = useState(false);

  const ordenesPreviasRef = useRef(new Map());
  const inicializadoRef = useRef(false);
  const audioCtxRef = useRef(null);
  const cambioLocalEnCursoRef = useRef(new Map());

  const desbloquearAudioContext = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }

      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      if (audioCtxRef.current.state === 'running') {
        setAudioHabilitado(true);
      }

      return audioCtxRef.current;
    } catch (e) {
      console.log('Audio pendiente de interacción del usuario:', e);
      return null;
    }
  };

  useEffect(() => {
    const manejarInteraccionUsuario = () => {
      desbloquearAudioContext();
    };

    window.addEventListener('pointerdown', manejarInteraccionUsuario, { passive: true });
    window.addEventListener('keydown', manejarInteraccionUsuario, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', manejarInteraccionUsuario);
      window.removeEventListener('keydown', manejarInteraccionUsuario);
    };
  }, []);

  const reproducirAlertaSonora = async (tipo = 'nueva') => {
    try {
      const audioCtx = await desbloquearAudioContext();
      if (!audioCtx) return;

      const ahora = audioCtx.currentTime;

      if (tipo === 'cancelada') {
        [0, 0.22].forEach((offset) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(340, ahora + offset);
          osc.frequency.linearRampToValueAtTime(195, ahora + offset + 0.18);

          gain.gain.setValueAtTime(0.001, ahora + offset);
          gain.gain.linearRampToValueAtTime(0.24, ahora + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ahora + offset + 0.2);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(ahora + offset);
          osc.stop(ahora + offset + 0.21);
        });
        return;
      }

      if (tipo === 'modificada') {
        [0, 0.16].forEach((offset) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(740, ahora + offset);
          osc.frequency.exponentialRampToValueAtTime(987.77, ahora + offset + 0.11);

          gain.gain.setValueAtTime(0.001, ahora + offset);
          gain.gain.linearRampToValueAtTime(0.22, ahora + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ahora + offset + 0.14);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(ahora + offset);
          osc.stop(ahora + offset + 0.15);
        });
        return;
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ahora);
      osc.frequency.exponentialRampToValueAtTime(880, ahora + 0.15);

      gain.gain.setValueAtTime(0.001, ahora);
      gain.gain.linearRampToValueAtTime(0.22, ahora + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.45);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(ahora);
      osc.stop(ahora + 0.46);
    } catch (e) {
      console.log('Error reproduciendo alerta sonora:', e);
    }
  };

  const calcularCostoDomicilio = (orden) => {
    const tipoServicio = String(orden?.tipo_servicio || '').toLowerCase();
    if (!tipoServicio.includes('domicilio') && !tipoServicio.includes('delivery')) {
      return 0;
    }

    const ubicacion = String(orden?.ubicacion_detalle || orden?.direccion || '').toLowerCase();
    const zonaMatch = coberturaZonas.find(
      (z) => z.activo !== false && z.barrio_zona && ubicacion.includes(String(z.barrio_zona).toLowerCase())
    );

    if (zonaMatch) {
      return Number(zonaMatch.precio_domicilio || 0);
    }

    return 5000;
  };

  const registrarOrdenCancelada = (ordenData) => {
    if (!ordenData || !ordenData.id) return;
    setOrdenesCanceladas((prev) => {
      const filtradas = prev.filter((item) => item.id !== ordenData.id);
      return [...filtradas, { ...ordenData, _canceladaEn: Date.now() }];
    });
    setOrdenModificadaInfo((prev) => {
      if (!prev[ordenData.id]) return prev;
      const copia = { ...prev };
      delete copia[ordenData.id];
      return copia;
    });
  };

  const descartarOrdenCancelada = (ordenId) => {
    setOrdenesCanceladas((prev) => prev.filter((item) => item.id !== ordenId));
    ordenesPreviasRef.current.delete(ordenId);
  };

  const sincronizarMapaOrdenes = (listaOrdenes, dispararAlertasPorDiff = false) => {
    const mapaSiguiente = new Map();
    let huboNueva = false;
    let huboModificada = false;

    setOrdenModificadaInfo((infoPrev) => {
      const siguienteInfo = { ...infoPrev };

      listaOrdenes.forEach((ord) => {
        mapaSiguiente.set(ord.id, ord);
        const anterior = ordenesPreviasRef.current.get(ord.id);

        if (!anterior) {
          if (dispararAlertasPorDiff && inicializadoRef.current) {
            huboNueva = true;
          }
        } else {
          const diff = detectarCambiosEnOrden(anterior, ord);
          if (diff.modificada) {
            siguienteInfo[ord.id] = diff;
            if (dispararAlertasPorDiff) {
              huboModificada = true;
            }
          }
        }
      });

      Object.keys(siguienteInfo).forEach((idStr) => {
        const idNum = Number(idStr);
        if (!mapaSiguiente.has(idNum)) {
          delete siguienteInfo[idStr];
        }
      });

      return siguienteInfo;
    });

    ordenesPreviasRef.current = mapaSiguiente;
    inicializadoRef.current = true;

    if (huboNueva) {
      reproducirAlertaSonora('nueva');
    } else if (huboModificada) {
      reproducirAlertaSonora('modificada');
    }
  };

  const cargarZonasCobertura = async () => {
    try {
      const { data, error } = await supabase
        .from('cobertura_zonas')
        .select('*')
        .order('id', { ascending: true });
      if (!error && Array.isArray(data)) {
        setCoberturaZonas(data);
      }
    } catch (e) {
      console.log('No se pudieron cargar zonas de cobertura:', e);
    }
  };

  const obtenerOrdenes = async ({ alertarEnCambios = false } = {}) => {
    try {
      const { data, error } = await supabase
        .from('ordenes')
        .select('*')
        .or('estado.ilike.pendiente,estado.ilike.en_proceso,estado.ilike.en proceso')
        .order('id', { ascending: true });

      if (error) throw error;

      const nuevasOrdenes = data || [];
      sincronizarMapaOrdenes(nuevasOrdenes, alertarEnCambios);
      setOrdenes(nuevasOrdenes);
    } catch (error) {
      console.error('Error al obtener órdenes:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarZonasCobertura();
    obtenerOrdenes({ alertarEnCambios: false });

    const channel = supabase
      .channel('ordenes-cocina-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes' },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const estadoNuevo = String(payload.new.estado || '').toLowerCase().trim();
            if (ESTADOS_ACTIVOS_COCINA.has(estadoNuevo)) {
              await reproducirAlertaSonora('nueva');
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const ordenNueva = payload.new;
            const estadoNuevo = String(ordenNueva.estado || '').toLowerCase().trim();
            const anterior = ordenesPreviasRef.current.get(ordenNueva.id);
            const cambioLocal = cambioLocalEnCursoRef.current.get(ordenNueva.id);

            if (ESTADOS_CANCELADOS.has(estadoNuevo)) {
              registrarOrdenCancelada(ordenNueva);
              await reproducirAlertaSonora('cancelada');
              await obtenerOrdenes({ alertarEnCambios: false });
              return;
            }

            if (ESTADOS_ACTIVOS_COCINA.has(estadoNuevo)) {
              if (cambioLocal) {
                cambioLocalEnCursoRef.current.delete(ordenNueva.id);
              } else if (anterior) {
                const diff = detectarCambiosEnOrden(anterior, ordenNueva);
                if (diff.modificada) {
                  setOrdenModificadaInfo((prev) => ({
                    ...prev,
                    [ordenNueva.id]: diff
                  }));
                  await reproducirAlertaSonora('modificada');
                }
              }
            } else if (cambioLocal) {
              cambioLocalEnCursoRef.current.delete(ordenNueva.id);
            }
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            const anterior = ordenesPreviasRef.current.get(payload.old.id);
            if (anterior) {
              registrarOrdenCancelada({ ...anterior, estado: 'cancelada' });
              await reproducirAlertaSonora('cancelada');
            }
          }

          await obtenerOrdenes({ alertarEnCambios: false });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const limpiarResaltadoOrden = (ordenId) => {
    setOrdenModificadaInfo((prev) => {
      if (!prev[ordenId]) return prev;
      const copia = { ...prev };
      delete copia[ordenId];
      return copia;
    });
  };

  const manejarAccionTarjeta = async (orden) => {
    await desbloquearAudioContext();
    limpiarResaltadoOrden(orden.id);

    const estadoActual = (orden.estado || 'Pendiente').toLowerCase().trim();
    let nuevoEstado = '';
    let datosActualizacion = {};
    const ahora = new Date().toISOString();

    if (estadoActual === 'pendiente') {
      nuevoEstado = 'en_proceso';
      datosActualizacion = {
        estado: nuevoEstado,
        tiempo_inicio: ahora
      };
    } else if (estadoActual === 'en_proceso' || estadoActual === 'en proceso') {
      nuevoEstado = 'listo';

      let duracionTexto = '0 min';
      if (orden.tiempo_inicio) {
        const inicio = new Date(orden.tiempo_inicio).getTime();
        const fin = new Date(ahora).getTime();
        const diffSegundos = Math.max(0, Math.floor((fin - inicio) / 1000));
        const mins = Math.floor(diffSegundos / 60);
        const segs = diffSegundos % 60;
        duracionTexto = mins > 0 ? `${mins} min ${segs} seg` : `${segs} seg`;
      }

      datosActualizacion = {
        estado: nuevoEstado,
        tiempo_fin: ahora,
        duracion_preparacion: duracionTexto
      };
    }

    if (nuevoEstado) {
      cambioLocalEnCursoRef.current.set(orden.id, {
        estadoAnterior: estadoActual,
        estadoNuevo: nuevoEstado,
        ts: Date.now()
      });

      try {
        const { error } = await supabase
          .from('ordenes')
          .update(datosActualizacion)
          .eq('id', orden.id);

        if (error) throw error;

        if (nuevoEstado === 'listo') {
          await asignarDomiciliarioAlCompletarCocina(orden.id, orden.tipo_servicio);
        }

        await obtenerOrdenes({ alertarEnCambios: false });
      } catch (error) {
        cambioLocalEnCursoRef.current.delete(orden.id);
        console.error('Error al actualizar estado en cocina:', error);
      }
    }
  };

  const imprimirFacturaOrden = (orden) => {
    setOrdenImprimiendo(orden);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const CronometroActivo = ({ tiempoInicio }) => {
    const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);

    useEffect(() => {
      if (!tiempoInicio) return;
      const calcularTiempo = () => {
        const inicio = new Date(tiempoInicio).getTime();
        const ahora = new Date().getTime();
        const diff = Math.floor((ahora - inicio) / 1000);
        setSegundosTranscurridos(diff > 0 ? diff : 0);
      };

      calcularTiempo();
      const timer = setInterval(calcularTiempo, 1000);
      return () => clearInterval(timer);
    }, [tiempoInicio]);

    const minutos = Math.floor(segundosTranscurridos / 60);
    const segundos = segundosTranscurridos % 60;
    const formatoTiempo = minutos > 0 ? `${minutos}m ${segundos}s` : `${segundos}s`;

    return (
      <div className="flex items-center gap-1 bg-black/70 border border-amber-500/50 px-2.5 py-1 rounded-lg text-amber-300 font-mono text-xs font-bold">
        <Clock className="w-3.5 h-3.5" />
        <span>{formatoTiempo}</span>
      </div>
    );
  };

  const renderizarArticulos = (itemsRaw, cambiosPorIndice = {}, itemsEliminados = []) => {
    if (!itemsRaw && itemsEliminados.length === 0) {
      return <span className="text-neutral-400 text-sm">Sin descripción de productos</span>;
    }

    let listaItems = itemsRaw;
    if (typeof itemsRaw === 'string') {
      try {
        const parsed = JSON.parse(itemsRaw);
        if (!Array.isArray(parsed)) {
          return <p className="text-sm sm:text-base font-bold text-amber-100">{itemsRaw}</p>;
        }
        listaItems = parsed;
      } catch {
        return <p className="text-sm sm:text-base font-bold text-amber-100">{itemsRaw}</p>;
      }
    }

    if (Array.isArray(listaItems)) {
      return (
        <div className="space-y-2.5">
          {listaItems.map((item, index) => {
            const cantidad = item?.cantidad || 1;
            const nombre = item?.nombre || item?.titulo || item?.producto || 'Artículo';
            const observacion = item?.observacion || item?.nota || '';
            const cambio = cambiosPorIndice[index];
            const itemResaltado = Boolean(cambio);

            return (
              <div
                key={index}
                className={`border-b border-white/10 pb-2 last:border-b-0 last:pb-0 rounded-lg transition-colors ${
                  itemResaltado
                    ? 'bg-amber-500/20 border border-amber-400 px-2.5 py-1.5'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 text-sm sm:text-base font-extrabold text-white leading-snug">
                  <span className={itemResaltado ? 'text-amber-200' : 'text-white'}>
                    <span
                      className={
                        cambio?.cantidadCambio || cambio?.esNuevo
                          ? 'text-amber-400 underline decoration-amber-400 font-black'
                          : 'text-amber-400'
                      }
                    >
                      {cantidad}x
                    </span>{' '}
                    {nombre}
                  </span>
                  {cambio?.esNuevo && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-neutral-950 shrink-0">
                      Nuevo
                    </span>
                  )}
                  {!cambio?.esNuevo && cambio?.cantidadCambio && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-neutral-950 shrink-0">
                      Cant.
                    </span>
                  )}
                </div>
                {observacion && (
                  <p
                    className={`text-xs sm:text-sm font-bold mt-1 px-2 py-0.5 rounded inline-block ${
                      cambio?.notaCambio
                        ? 'bg-amber-400 text-neutral-950 font-black'
                        : 'text-amber-300 bg-black/50 border border-amber-500/30'
                    }`}
                  >
                    Nota: {observacion}
                  </p>
                )}
              </div>
            );
          })}

          {itemsEliminados.length > 0 && (
            <div className="pt-2 border-t border-amber-500/40 space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                Quitado de la orden:
              </span>
              {itemsEliminados.map((rem, idx) => (
                <p
                  key={idx}
                  className="text-xs sm:text-sm font-bold line-through text-neutral-400 bg-black/50 px-2 py-1 rounded border border-neutral-800"
                >
                  {rem.cantidad}x {rem.nombre}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <p className="text-sm sm:text-base font-bold text-amber-100">{JSON.stringify(listaItems)}</p>;
  };

  const ordenEstaPagada = ordenImprimiendo
    ? String(ordenImprimiendo.estado_pago || '').toLowerCase().trim() === 'pagado'
    : false;

  const esDomicilioImpresion = ordenImprimiendo
    ? String(ordenImprimiendo.tipo_servicio || '').toLowerCase().includes('domicilio') ||
      String(ordenImprimiendo.tipo_servicio || '').toLowerCase().includes('delivery')
    : false;

  const costoDomicilioImpresion = ordenImprimiendo ? calcularCostoDomicilio(ordenImprimiendo) : 0;
  const subtotalImpresion = ordenImprimiendo ? Number(ordenImprimiendo.subtotal || ordenImprimiendo.total || 0) : 0;
  const totalImpresion = subtotalImpresion + (esDomicilioImpresion ? costoDomicilioImpresion : 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-3 sm:p-5 select-none flex flex-col justify-between">
      {/* FACTURA / TICKET IGUAL AL MÓDULO DE ÓRDENES CON VALIDACIÓN DE PAGO */}
      {ordenImprimiendo && (
        <div className="hidden print:block fixed inset-0 bg-white text-black text-sm p-4 z-[9999] font-mono">
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: "url('/logo.png')",
              backgroundSize: '60px',
              backgroundRepeat: 'repeat',
              backgroundPosition: 'center',
              opacity: 0.08,
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}
          ></div>

          <div className="relative z-10 max-w-[80mm] mx-auto">
            <div className="text-center mb-4">
              <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-2 object-contain" />
              <h1 className="text-xl font-black uppercase">Delicius Burguers</h1>
              <p className="text-xs font-bold">NIT: 1099543892</p>
              <p className="text-xs mt-1">Orden #{ordenImprimiendo.numero_orden || ordenImprimiendo.id}</p>
              <p className="text-xs">{new Date().toLocaleString()}</p>
            </div>

            {ordenEstaPagada ? (
              <div
                className="border-[2px] font-black text-center py-1.5 mb-4 text-sm uppercase"
                style={{
                  color: '#15803d',
                  borderColor: '#15803d',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                }}
              >
                ESTADO DE PAGO: PAGADO
                <span className="block text-[11px] mt-0.5">
                  Método: {ordenImprimiendo.metodo_pago || 'No especificado'}
                </span>
              </div>
            ) : (
              <div
                className="border-[3px] font-black text-center py-2 mb-4 text-lg uppercase"
                style={{
                  color: '#dc2626',
                  borderColor: '#dc2626',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                }}
              >
                ¡ATENCIÓN: NO PAGADO!
                <span className="block text-xs mt-1">Cobrar antes de entregar</span>
              </div>
            )}

            <div className="mb-4 border-b border-black border-dashed pb-3">
              <p><strong>Cliente:</strong> {ordenImprimiendo.cliente_nombre || 'General'}</p>
              <p><strong>Servicio:</strong> {ordenImprimiendo.tipo_servicio || 'Local'}</p>

              {esDomicilioImpresion && (
                <>
                  <p><strong>Dirección:</strong> {ordenImprimiendo.direccion || ordenImprimiendo.ubicacion_detalle || 'N/A'}</p>
                  <p className="text-xs mt-1"><strong>Costo Domicilio:</strong> ${costoDomicilioImpresion.toLocaleString()}</p>
                </>
              )}
            </div>

            <div className="mb-4 border-b border-black border-dashed pb-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black">
                    <th className="pb-1 w-8">Cant</th>
                    <th className="pb-1">Detalle (Cat / Producto)</th>
                    <th className="pb-1 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="pt-1" style={{ display: 'table-row-group' }}>
                  {parsearItemsSeguros(ordenImprimiendo.items).map((item, index) => (
                    <tr key={index}>
                      <td className="align-top pt-2 pr-1 font-bold">{item?.cantidad || 1}x</td>
                      <td className="align-top pt-2">
                        <span className="font-bold">{item?.nombre || item?.titulo || item?.producto || 'Artículo'}</span>
                        {(item?.observacion || item?.nota) && (
                          <div className="text-[10px] italic text-gray-700">
                            - Nota: {item?.observacion || item?.nota}
                          </div>
                        )}
                      </td>
                      <td className="align-top pt-2 text-right whitespace-nowrap">
                        ${Number(item?.precio || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-6 text-right">
              <p className="text-2xl font-black mt-1">
                TOTAL: $ {totalImpresion.toLocaleString()}
              </p>
            </div>

            <div className="text-center mt-4">
              <p className="font-bold">¡Gracias por elegirnos!</p>
              <p className="text-xs mt-2">Pide por WhatsApp:</p>
              <p className="text-base font-black">316 294 2033</p>
              <p className="text-[10px] text-gray-400 mt-6 opacity-60 italic">Desarrollado por Vértizze</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                DELICIUS <span className="text-amber-500">BURGUES</span> - COCINA (KDS)
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Toca la tarjeta para avanzar estado • Alerta sonora solo en cambios de orden o cancelaciones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => reproducirAlertaSonora('nueva')}
              title="Probar sonido de alerta"
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 flex items-center gap-1.5 cursor-pointer transition-all touch-manipulation"
            >
              <Bell className="w-4 h-4" />
              <span>{audioHabilitado ? 'Probar Sonido' : 'Activar / Probar Sonido'}</span>
            </button>

            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs font-bold text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Sistema en Línea</span>
            </div>
          </div>
        </div>

        {cargando && ordenes.length === 0 && ordenesCanceladas.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 text-sm font-semibold">
            Sincronizando órdenes con la base de datos...
          </div>
        ) : ordenes.length === 0 && ordenesCanceladas.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-2">
            <ChefHat className="w-11 h-11 text-neutral-700 mx-auto" />
            <p className="text-sm font-bold text-neutral-300">No hay pedidos pendientes en la cola</p>
            <p className="text-xs text-neutral-500">Los nuevos pedidos aparecerán automáticamente aquí al crearse.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {ordenesCanceladas.map((ordenCancelada) => {
              const numeroMesa = ordenCancelada.mesa || ordenCancelada.numero_mesa || ordenCancelada.mesa_id;
              const tipoServicioRaw = (ordenCancelada.tipo_servicio || '').toLowerCase();
              const esDomicilio = tipoServicioRaw.includes('domicilio') || tipoServicioRaw.includes('delivery');

              return (
                <div
                  key={`cancelada-${ordenCancelada.id}`}
                  className="border-2 border-amber-500/80 bg-neutral-950 text-white rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden min-h-[280px]"
                >
                  {/* MARCA CON X GRANDE SOBRE LA ORDEN CANCELADA */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
                    <span className="text-[128px] leading-none font-black text-amber-500/35 select-none">
                      ✕
                    </span>
                  </div>

                  <div className="relative z-30 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black bg-neutral-900 px-2.5 py-1 rounded-lg border border-amber-500/50 text-amber-300">
                          #{ordenCancelada.numero_orden || ordenCancelada.id}
                        </span>
                        <span className="text-xs font-black bg-amber-500 text-neutral-950 px-2.5 py-1 rounded-lg uppercase">
                          Cancelada
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {numeroMesa && (
                          <span className="text-xs font-black bg-amber-500 text-neutral-950 px-2 py-1 rounded-lg flex items-center gap-1">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            M{numeroMesa}
                          </span>
                        )}
                        <span className="text-xs font-black bg-neutral-800 border border-white/15 text-amber-300 px-2 py-1 rounded-lg flex items-center gap-1 uppercase">
                          {esDomicilio ? <Bike className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                          {esDomicilio ? 'Domicilio' : 'Local'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-neutral-300 line-through truncate">
                        {ordenCancelada.cliente_nombre || 'Cliente'}
                      </h3>
                    </div>

                    <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3">
                      <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider block mb-1.5">
                        Artículos cancelados:
                      </span>
                      <div className="opacity-75">
                        {renderizarArticulos(ordenCancelada.items)}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-30 mt-4 pt-3 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => descartarOrdenCancelada(ordenCancelada.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <X className="w-4 h-4" />
                      <span>Quitar Cancelada</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {ordenes.map((orden) => {
              const estadoActual = (orden.estado || 'pendiente').toLowerCase().trim();
              const enProceso = estadoActual === 'en_proceso' || estadoActual === 'en proceso';
              const numeroMesa = orden.mesa || orden.numero_mesa || orden.mesa_id;
              const tipoServicioRaw = (orden.tipo_servicio || '').toLowerCase();
              const esDomicilio = tipoServicioRaw.includes('domicilio') || tipoServicioRaw.includes('delivery');
              const infoCambio = ordenModificadaInfo[orden.id];
              const estaModificada = Boolean(infoCambio?.modificada);

              let estilosTarjeta = 'border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-neutral-600';
              let franjaColor = 'bg-neutral-700';
              let textoBotonAccion = 'Iniciar Preparación';
              let estiloBotonAccion = 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/15';

              if (enProceso) {
                estilosTarjeta = 'border-amber-500/80 bg-neutral-900 text-white hover:border-amber-400';
                franjaColor = 'bg-amber-500';
                textoBotonAccion = 'Marcar como Listo';
                estiloBotonAccion = 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black';
              }

              if (estaModificada) {
                estilosTarjeta = 'border-amber-400 bg-neutral-900 text-white ring-2 ring-amber-400/50 hover:border-amber-300';
                franjaColor = 'bg-amber-400';
              }

              return (
                <div
                  key={orden.id}
                  onClick={() => manejarAccionTarjeta(orden)}
                  className={`border-2 rounded-2xl p-4 flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer active:scale-[0.99] touch-manipulation min-h-[280px] ${estilosTarjeta}`}
                >
                  <div className={`absolute top-0 inset-x-0 h-1.5 ${franjaColor}`}></div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black bg-black/60 px-2.5 py-1 rounded-lg border border-white/15 text-amber-300">
                          #{orden.numero_orden || orden.id}
                        </span>

                        {estaModificada && (
                          <span className="text-[11px] font-black bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-lg uppercase flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Modificada
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {enProceso && orden.tiempo_inicio && (
                          <CronometroActivo tiempoInicio={orden.tiempo_inicio} />
                        )}

                        {numeroMesa && (
                          <span className="text-xs font-black bg-amber-500 text-neutral-950 px-2 py-1 rounded-lg flex items-center gap-1">
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                            M{numeroMesa}
                          </span>
                        )}

                        <span className="text-xs font-black bg-neutral-800 border border-white/15 text-amber-300 px-2 py-1 rounded-lg flex items-center gap-1 uppercase">
                          {esDomicilio ? <Bike className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                          {esDomicilio ? 'Domicilio' : 'Local'}
                        </span>

                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            imprimirFacturaOrden(orden);
                          }}
                          title="Imprimir factura de la orden"
                          className="bg-black/60 hover:bg-black border border-white/15 text-neutral-200 hover:text-amber-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Imprimir</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                        {orden.cliente_nombre || 'Cliente'}
                      </h3>
                      <span className="text-xs text-amber-300/90 font-bold capitalize shrink-0">
                        {orden.metodo_pago || 'Efectivo'}
                      </span>
                    </div>

                    <div className="bg-black/45 border border-white/10 rounded-xl p-3 space-y-1.5">
                      <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider block">
                        Artículos:
                      </span>
                      {renderizarArticulos(
                        orden.items,
                        infoCambio?.cambiosPorIndice || {},
                        infoCambio?.itemsEliminados || []
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/15">
                    <div
                      className={`w-full py-2.5 rounded-xl text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center ${estiloBotonAccion}`}
                    >
                      <span>{textoBotonAccion}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
