// ============================================================================
// ARCHIVO: src/vistas/cliente/PantallaCheckout.jsx
// DESCRIPCIÓN: Checkout con cierre automático del buscador de zonas al hacer clic afuera.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Banknote, 
  Smartphone, 
  UtensilsCrossed, 
  ShoppingBag,
  Bike,
  Send,
  User,
  MapPin,
  Search,
  AlertCircle
} from 'lucide-react';
import { supabase, obtenerZonasCobertura } from '../../sdk/vertizzeApi';

export default function PantallaCheckout({ 
  carrito, 
  modoPedido, 
  alVolverAlCarrito, 
  alConfirmarPedido 
}) {
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [detalleMesaOBarrio, setDetalleMesaOBarrio] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [procesando, setProcesando] = useState(false);

  // Estados para Zonas de Cobertura
  const [zonas, setZonas] = useState([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [busquedaZona, setBusquedaZona] = useState('');
  const [mostrarDropdownZonas, setMostrarDropdownZonas] = useState(false);
  const [cargandoZonas, setCargandoZonas] = useState(false);

  // Referencia para detectar clics fuera del buscador de zonas
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (modoPedido === 'domicilio') {
      async function cargarZonas() {
        setCargandoZonas(true);
        const listaZonas = await obtenerZonasCobertura();
        setZonas(listaZonas);
        setCargandoZonas(false);
      }
      cargarZonas();
    }
  }, [modoPedido]);

  // Efecto para cerrar el desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarDropdownZonas(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cálculos de Totales
  const subtotal = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const costoDomicilio = modoPedido === 'domicilio' && zonaSeleccionada ? Number(zonaSeleccionada.precio_domicilio) : 0;
  const totalFinal = subtotal + costoDomicilio;

  const formatearPrecio = (valor) => {
    return `$ ${(valor || 0).toLocaleString('es-CO')}`;
  };

  const obtenerInfoServicio = () => {
    switch (modoPedido) {
      case 'para_servir':
        return { texto: 'Para comer aquí', Icono: UtensilsCrossed };
      case 'para_recoger':
        return { texto: 'Para llevar', Icono: ShoppingBag };
      case 'domicilio':
        return { texto: 'Domicilio', Icono: Bike };
      default:
        return { texto: 'Para comer aquí', Icono: UtensilsCrossed };
    }
  };

  const { texto: textoServicio, Icono: IconoServicio } = obtenerInfoServicio();

  const handleNombreChange = (e) => {
    setNombreCliente(e.target.value.replace(/[0-9]/g, ''));
  };

  const handleTelefonoChange = (e) => {
    setTelefonoCliente(e.target.value.replace(/[^0-9]/g, ''));
  };

  // Filtrado de zonas por búsqueda
  const zonasFiltradas = zonas.filter(z => 
    z.barrio_zona.toLowerCase().includes(busquedaZona.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
     
    if (modoPedido === 'domicilio' && !zonaSeleccionada) {
      alert('Por favor selecciona tu Barrio / Zona de cobertura.');
      return;
    }

    if (procesando) return;
    setProcesando(true);

    const ubicacionFinal = modoPedido === 'domicilio'
      ? `Zona: ${zonaSeleccionada.barrio_zona} | Dir: ${detalleMesaOBarrio}`
      : (detalleMesaOBarrio || textoServicio);

    const datosOrden = {
      numero_orden: Math.floor(1000 + Math.random() * 9000),
      cliente_nombre: nombreCliente,
      telefono: telefonoCliente,
      ubicacion_detalle: ubicacionFinal,
      tipo_servicio: textoServicio,
      observaciones: '',
      items: JSON.stringify(carrito),
      subtotal,
      domicilio: costoDomicilio,
      total: totalFinal,
      metodo_pago: metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia',
      estado: 'Pendiente',
      estado_pago: metodoPago === 'efectivo' ? 'Por Pagar' : 'Por Verificar'
    };

    try {
      const { data, error } = await supabase
        .from('ordenes')
        .insert([datosOrden])
        .select()
        .single();

      if (error) throw error;
       
      setProcesando(false);
      alConfirmarPedido(data);

    } catch (err) {
      console.error("Error al registrar la orden:", err);
      alert("Hubo un error al procesar la solicitud.");
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none pb-12">
       
      {/* HEADER FIJO */}
      <header className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-900 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            type="button"
            onClick={alVolverAlCarrito}
            disabled={procesando}
            className="flex items-center gap-2 text-neutral-400 hover:text-amber-400 bg-neutral-900 hover:bg-neutral-800 px-3 sm:px-4 py-2 rounded-xl border border-neutral-800 transition-all cursor-pointer disabled:opacity-50 text-xs sm:text-sm touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Volver al Carrito</span>
          </button>

          <div className="text-center">
            <h1 className="text-base sm:text-lg font-black tracking-wider text-white uppercase">
              FINALIZAR <span className="text-amber-500">PEDIDO</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-400 text-xs font-semibold">
            <IconoServicio className="w-3.5 h-3.5" />
            <span>{textoServicio}</span>
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           
          <div className="lg:col-span-2 space-y-6">
             
            {/* 1. Información de Contacto con Validaciones */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-md">
              <h2 className="text-base font-extrabold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                <span>1. Información de Contacto</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Tu Nombre *</label>
                  <input 
                    type="text" required placeholder="Ej. Carlos Pérez"
                    value={nombreCliente} onChange={handleNombreChange}
                    disabled={procesando}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">Solo letras y espacios</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Celular / WhatsApp *</label>
                  <input 
                    type="tel" required placeholder="Ej. 3001234567"
                    value={telefonoCliente} onChange={handleTelefonoChange}
                    disabled={procesando}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">Solo números</span>
                </div>
              </div>

              {/* SELECTOR DINÁMICO DE ZONAS PARA DOMICILIO (ENVUELTO EN REF) */}
              {modoPedido === 'domicilio' && (
                <div className="space-y-4 pt-2 border-t border-neutral-800/80" ref={dropdownRef}>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-amber-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Barrio / Zona de Cobertura *
                    </label>

                    {/* MENSAJE GUÍA PARA EL CLIENTE */}
                    <p className="text-xs text-neutral-400 mb-2">
                      Escribe o busca en la lista el barrio o zona donde te encuentras para calcular el envío:
                    </p>

                    <div className="relative">
                      <input 
                        type="text"
                        placeholder={cargandoZonas ? "Cargando cobertura..." : "Busca tu barrio aquí..."}
                        value={zonaSeleccionada ? zonaSeleccionada.barrio_zona : busquedaZona}
                        onChange={(e) => {
                          setBusquedaZona(e.target.value);
                          setZonaSeleccionada(null);
                          setMostrarDropdownZonas(true);
                        }}
                        onFocus={() => setMostrarDropdownZonas(true)}
                        disabled={procesando || cargandoZonas}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 pl-10 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                      />
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                    </div>

                    {mostrarDropdownZonas && !zonaSeleccionada && (
                      <div className="absolute z-20 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-h-56 overflow-y-auto">
                        {zonasFiltradas.length === 0 ? (
                          <div className="p-3 text-xs text-neutral-500 text-center">No encontramos cobertura para esta zona</div>
                        ) : (
                          zonasFiltradas.map((zona) => (
                            <button
                              key={zona.id}
                              type="button"
                              onClick={() => {
                                setZonaSeleccionada(zona);
                                setBusquedaZona(zona.barrio_zona);
                                setMostrarDropdownZonas(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-neutral-800 flex justify-between items-center text-xs border-b border-neutral-800/50 last:border-0 cursor-pointer"
                            >
                              <span className="font-semibold text-white">{zona.barrio_zona}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Dirección Exacta (Calle / Carrera / Apto) *</label>
                    <input 
                      type="text" required
                      placeholder="Ej. Calle 50 # 45-22 Apto 301"
                      value={detalleMesaOBarrio} onChange={(e) => setDetalleMesaOBarrio(e.target.value)}
                      disabled={procesando}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    />
                  </div>

                  {/* NOTA ACLARATORIA DE VARIACIÓN Y DIRECCIÓN */}
                  <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl text-amber-300 text-xs leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <p>
                      <strong className="font-bold text-amber-400">Nota importante:</strong> Si la dirección brindada no concuerda con la zona seleccionada o hay alguna variación en la ubicación real, el domiciliario cobrará el valor correspondiente al momento de la entrega.
                    </p>
                  </div>
                </div>
              )}

              {modoPedido !== 'domicilio' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Número de Mesa o Notas</label>
                  <input 
                    type="text" placeholder="Ej. Mesa 4"
                    value={detalleMesaOBarrio} onChange={(e) => setDetalleMesaOBarrio(e.target.value)}
                    disabled={procesando}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              )}
            </div>

            {/* 2. Método de Pago */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-md">
              <h2 className="text-base font-extrabold text-white border-b border-neutral-800 pb-3">
                2. Método de Pago
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => setMetodoPago('efectivo')}
                  className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border transition-all cursor-pointer disabled:opacity-50 touch-manipulation ${
                    metodoPago === 'efectivo' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Banknote className="w-7 h-7" />
                  <span className="text-xs font-bold">Efectivo en Local</span>
                </button>

                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => setMetodoPago('transferencia')}
                  className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border transition-all cursor-pointer disabled:opacity-50 touch-manipulation ${
                    metodoPago === 'transferencia' ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Smartphone className="w-7 h-7" />
                  <span className="text-xs font-bold">Transferencia</span>
                </button>
              </div>
            </div>

          </div>

          {/* Resumen Final */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-fit space-y-6 shadow-xl">
            <h3 className="text-lg font-bold border-b border-neutral-800 pb-4">Resumen Final</h3>

            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {carrito.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-neutral-300">
                  <span className="truncate max-w-[150px]">{item.cantidad}x {item.nombre}</span>
                  <span className="font-semibold text-white">{formatearPrecio(item.precio * item.cantidad)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-800 pt-4 space-y-3 text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span className="text-white font-medium">{formatearPrecio(subtotal)}</span>
              </div>

              {modoPedido === 'domicilio' && (
                <div className="flex justify-between text-neutral-400">
                  <span>Domicilio ({zonaSeleccionada ? zonaSeleccionada.barrio_zona : 'Pendiente'})</span>
                  <span className="text-amber-400 font-medium">{formatearPrecio(costoDomicilio)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-400">
                <span>Tipo de Servicio</span>
                <span className="text-white font-medium">{textoServicio}</span>
              </div>

              <div className="border-t border-neutral-800 pt-3 flex justify-between text-base font-black">
                <span className="text-white">Total Final</span>
                <span className="text-amber-400 text-xl">{formatearPrecio(totalFinal)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={procesando}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 disabled:opacity-50 touch-manipulation"
            >
              <Send className="w-4 h-4" />
              <span>{procesando ? 'Confirmando...' : 'Confirmar Pedido'}</span>
            </button>
          </div>

        </form>
      </main>

      {/* FOOTER / MARCA DE AGUA */}
      <footer className="text-center text-xs text-neutral-500 py-4 mt-auto">
        Sistema Operado por <span className="font-semibold text-neutral-400">Vertizze</span> © 2026
      </footer>

    </div>
  );
}
