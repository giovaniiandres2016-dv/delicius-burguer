// ============================================================================
// ARCHIVO: src/vistas/cocina/PantallaCocina.jsx
// DESCRIPCIÓN: KDS optimizado en tiempo real y totalmente responsivo para Delicius Burguer.
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { Clock, ChefHat, Bell, UtensilsCrossed, Bike, Store, Printer, Sparkles } from 'lucide-react';
import { supabase } from '../../sdk/supabaseClient';
import { asignarDomiciliarioAlCompletarCocina } from '../../sdk/vertizzeApi';

const ESTADOS_ACTIVOS_COCINA = new Set(['pendiente', 'en_proceso', 'en proceso']);

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
  const clave = String(item?.id ?? `${nombre.toLowerCase()}__${index}`);
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

  const cambiosPorIndice = {};
  let huboCambioEnItems = false;

  itemsNext.forEach((it, idx) => {
    const norm = normalizarItemParaComparar(it, idx);
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

  if (itemsPrev.length !== itemsNext.length) {
    huboCambioEnItems = true;
  }

  const camposRelevantes = [
    'items',
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

  const huboCambioEnCabecera = camposRelevantes.some(
    (campo) => JSON.stringify(ordenAnterior?.[campo] ?? null) !== JSON.stringify(ordenNueva?.[campo] ?? null)
  );

  return {
    modificada: huboCambioEnItems || huboCambioEnCabecera,
    cambiosPorIndice,
    actualizadaEn: Date.now()
  };
}

export default function PantallaCocina() {
  const [ordenes, setOrdenes] = useState([]);
  const [coberturaZonas, setCoberturaZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ordenModificadaInfo, setOrdenModificadaInfo] = useState({});
  const [ordenImprimiendo, setOrdenImprimiendo] = useState(null);
  const [audioHabilitado, setAudioHabilitado] = useState(false);

  const ordenesPreviasRef = useRef(new Map());
  const inicializadoRef = useRef(false);
  const audioCtxRef = useRef(null);

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

      if (tipo === 'modificada') {
        [0, 0.18].forEach((offset) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(740, ahora + offset);
          osc.frequency.exponentialRampToValueAtTime(987.77, ahora + offset + 0.12);

          gain.gain.setValueAtTime(0.001, ahora + offset);
          gain.gain.linearRampToValueAtTime(0.24, ahora + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ahora + offset + 0.16);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(ahora + offset);
          osc.stop(ahora + offset + 0.17);
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
          if (payload.eventType === 'INSERT') {
            await reproducirAlertaSonora('nueva');
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const estadoNuevo = String(payload.new.estado || '').toLowerCase().trim();
            if (ESTADOS_ACTIVOS_COCINA.has(estadoNuevo)) {
              const anterior = ordenesPreviasRef.current.get(payload.new.id);
              if (anterior) {
                const diff = detectarCambiosEnOrden(anterior, payload.new);
                if (diff.modificada) {
                  setOrdenModificadaInfo((prev) => ({
                    ...prev,
                    [payload.new.id]: diff
                  }));
                }
              }
              await reproducirAlertaSonora('modificada');
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
      <div className="flex items-center gap-1 bg-black/60 border border-amber-500/40 px-2 py-0.5 rounded-md text-amber-300 font-mono text-[10px] font-bold">
        <Clock className="w-3 h-3" />
        <span>{formatoTiempo}</span>
      </div>
    );
  };

  const renderizarArticulos = (itemsRaw, cambiosPorIndice = {}) => {
    if (!itemsRaw) return <span className="text-white/60 text-xs">Sin descripción de productos</span>;

    if (typeof itemsRaw === 'string') {
      try {
        const parsed = JSON.parse(itemsRaw);
        if (!Array.isArray(parsed)) {
          return <p className="text-xs font-semibold text-amber-100">{itemsRaw}</p>;
        }
        itemsRaw = parsed;
      } catch {
        return <p className="text-xs font-semibold text-amber-100">{itemsRaw}</p>;
      }
    }

    if (Array.isArray(itemsRaw)) {
      return (
        <div className="space-y-1.5">
          {itemsRaw.map((item, index) => {
            const cantidad = item?.cantidad || 1;
            const nombre = item?.nombre || item?.titulo || item?.producto || 'Artículo';
            const observacion = item?.observacion || item?.nota || '';
            const cambio = cambiosPorIndice[index];
            const itemResaltado = Boolean(cambio);

            return (
              <div
                key={index}
                className={`border-b border-white/10 pb-1 last:border-b-0 last:pb-0 rounded-md transition-colors ${
                  itemResaltado
                    ? 'bg-fuchsia-500/20 border border-fuchsia-400/60 px-1.5 py-1'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-xs font-extrabold text-white leading-snug">
                  <span className={itemResaltado ? 'text-fuchsia-200' : 'text-white'}>
                    <span className={cambio?.cantidadCambio || cambio?.esNuevo ? 'text-amber-300 underline decoration-amber-400' : ''}>
                      {cantidad}x
                    </span>{' '}
                    {nombre}
                  </span>
                  {cambio?.esNuevo && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-fuchsia-400 text-neutral-950 shrink-0">
                      Nuevo
                    </span>
                  )}
                  {!cambio?.esNuevo && cambio?.cantidadCambio && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 shrink-0">
                      Cant.
                    </span>
                  )}
                </div>
                {observacion && (
                  <p
                    className={`text-[11px] font-bold italic mt-0.5 px-1.5 py-0.5 rounded inline-block ${
                      cambio?.notaCambio
                        ? 'bg-amber-400 text-neutral-950 not-italic font-black'
                        : 'text-amber-300 bg-black/35'
                    }`}
                  >
                    Nota: {observacion}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return <p className="text-xs font-semibold text-amber-100">{JSON.stringify(itemsRaw)}</p>;
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
    <div className="min-h-screen bg-neutral-950 text-white p-2.5 sm:p-4 select-none flex flex-col justify-between">
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

      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                DELICIUS <span className="text-amber-500">BURGUES</span> - COCINA (KDS)
              </h1>
              <p className="text-[11px] text-neutral-400">
                Toca la tarjeta para avanzar el estado • Órdenes modificadas resaltan en violeta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => reproducirAlertaSonora('nueva')}
              title="Probar sonido de alerta"
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 cursor-pointer transition-all touch-manipulation"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{audioHabilitado ? 'Probar Sonido' : 'Activar / Probar Sonido'}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sistema en Línea</span>
            </div>
          </div>
        </div>

        {cargando && ordenes.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-xs">
            Sincronizando órdenes con la base de datos...
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/40 border border-neutral-900 rounded-2xl space-y-2">
            <ChefHat className="w-10 h-10 text-neutral-700 mx-auto" />
            <p className="text-xs font-bold text-neutral-400">No hay pedidos pendientes en la cola</p>
            <p className="text-[11px] text-neutral-600">Los nuevos pedidos aparecerán automáticamente aquí al crearse.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pb-6">
            {ordenes.map((orden) => {
              const estadoActual = (orden.estado || 'pendiente').toLowerCase().trim();
              const numeroMesa = orden.mesa || orden.numero_mesa || orden.mesa_id;
              const tipoServicioRaw = (orden.tipo_servicio || '').toLowerCase();
              const esDomicilio = tipoServicioRaw.includes('domicilio') || tipoServicioRaw.includes('delivery');
              const infoCambio = ordenModificadaInfo[orden.id];
              const estaModificada = Boolean(infoCambio?.modificada);

              let estilosTarjeta = 'border-neutral-800 bg-neutral-900 text-neutral-100 hover:border-neutral-600';
              let franjaColor = 'bg-neutral-700';
              let textoBotonAccion = 'Iniciar Preparación';
              let estiloBotonAccion = 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/15';

              if (estadoActual === 'en_proceso' || estadoActual === 'en proceso') {
                estilosTarjeta = 'border-amber-500 bg-amber-950/90 text-amber-50 hover:border-amber-400';
                franjaColor = 'bg-amber-400';
                textoBotonAccion = 'Marcar como Listo';
                estiloBotonAccion = 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black';
              }

              if (estaModificada) {
                estilosTarjeta = 'border-fuchsia-400 bg-fuchsia-950/85 text-fuchsia-50 ring-2 ring-fuchsia-400/50 hover:border-fuchsia-300';
                franjaColor = 'bg-fuchsia-400';
              }

              return (
                <div
                  key={orden.id}
                  onClick={() => manejarAccionTarjeta(orden)}
                  className={`border-2 rounded-xl p-2.5 flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer active:scale-[0.99] touch-manipulation ${estilosTarjeta}`}
                >
                  <div className={`absolute top-0 inset-x-0 h-1 ${franjaColor}`}></div>

                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] font-black bg-black/50 px-2 py-0.5 rounded-md border border-white/10 text-amber-300">
                          #{orden.numero_orden || orden.id}
                        </span>

                        {estaModificada && (
                          <span className="text-[9px] font-black bg-fuchsia-400 text-neutral-950 px-1.5 py-0.5 rounded-md uppercase flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            Modificada
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {(estadoActual === 'en_proceso' || estadoActual === 'en proceso') && orden.tiempo_inicio && (
                          <CronometroActivo tiempoInicio={orden.tiempo_inicio} />
                        )}

                        {numeroMesa && (
                          <span className="text-[10px] font-black bg-amber-500 text-neutral-950 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <UtensilsCrossed className="w-2.5 h-2.5" />
                            M{numeroMesa}
                          </span>
                        )}

                        {esDomicilio ? (
                          <span className="text-[10px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 uppercase">
                            <Bike className="w-3 h-3" />
                            Domicilio
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-cyan-600 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 uppercase">
                            <Store className="w-3 h-3" />
                            Local
                          </span>
                        )}

                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            imprimirFacturaOrden(orden);
                          }}
                          title="Imprimir factura de la orden"
                          className="bg-black/50 hover:bg-black/80 border border-white/15 text-neutral-200 hover:text-amber-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Imprimir</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-black tracking-tight text-white truncate">
                        {orden.cliente_nombre || 'Cliente'}
                      </h3>
                      <span className="text-[10px] text-white/75 font-semibold capitalize shrink-0">
                        {orden.metodo_pago || 'Efectivo'}
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/10 rounded-lg p-2 space-y-1">
                      <span className="text-[9px] font-extrabold text-white/65 uppercase tracking-wider block">
                        Artículos:
                      </span>
                      {renderizarArticulos(orden.items, infoCambio?.cambiosPorIndice || {})}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-white/15">
                    <div
                      className={`w-full py-2 rounded-lg text-[11px] uppercase tracking-wider transition-all flex items-center justify-center ${estiloBotonAccion}`}
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
