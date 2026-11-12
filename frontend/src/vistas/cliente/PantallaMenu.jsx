// ============================================================================
// ARCHIVO: src/vistas/cliente/PantallaMenu.jsx
// DESCRIPCIÓN: Pantalla de menú interactiva y responsiva con categoría de Promociones dinámica.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { obtenerMenu } from '../../sdk/vertizzeApi';
import { 
  UtensilsCrossed, 
  ShoppingBag, 
  Bike, 
  ArrowLeft, 
  Search, 
  Plus, 
  ShoppingCart,
  Sparkles,
  Flame,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

function TarjetaImagen({ src, alt }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-600 gap-2">
        <ImageIcon className="w-8 h-8 text-neutral-700" />
        <span className="text-[10px] text-neutral-500 font-medium">Sin imagen</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt}
      onError={() => setError(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}

const capitalizarTexto = (texto) => {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
};

export default function PantallaMenu({ modoPedido, alVolverInicio, alIrAlCarrito, carrito, alAgregarAlCarrito }) {
  const [categoriaActiva, setCategoriaActiva] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [productosMenu, setProductosMenu] = useState([]);
  const [categoriasMenu, setCategoriasMenu] = useState([]);
  const [cargando, setCargando] = useState(true);

  const scrollContainerRef = useRef(null);

  const desplazarCategorias = (direccion) => {
    if (scrollContainerRef.current) {
      const valorScroll = direccion === 'izquierda' ? -250 : 250;
      scrollContainerRef.current.scrollBy({ left: valorScroll, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    async function cargarMenuDesdeBD() {
      try {
        setCargando(true);
        const datos = await obtenerMenu();
        const listaProductos = Array.isArray(datos) ? datos : (datos?.productos || []);
        setProductosMenu(listaProductos);

        // Verificación dinámica de existencia de promociones en la base de datos
        const hayPromociones = listaProductos.some(producto => {
          const catProducto = producto.categoria ? producto.categoria.toLowerCase() : '';
          return producto.en_promocion || producto.enPromocion || catProducto === 'promociones';
        });

        const categoriasUnicas = Array.from(new Set(listaProductos.map(p => p.categoria).filter(Boolean)));
        
        const categoriasFormateadas = [
          { id: 'todos', nombre: 'Todo el Menú', icono: Sparkles },
          ...(hayPromociones ? [{ id: 'promociones', nombre: 'Promociones', icono: Flame }] : []),
          ...categoriasUnicas
            .filter(cat => cat.toLowerCase() !== 'promociones')
            .map(cat => ({
              id: cat.toLowerCase(),
              nombre: capitalizarTexto(cat),
              icono: UtensilsCrossed
            }))
        ];

        setCategoriasMenu(categoriasFormateadas);
      } catch (error) {
        console.error("Error al cargar el menú:", error);
        setProductosMenu([]);
        setCategoriasMenu([
          { id: 'todos', nombre: 'Todo el Menú', icono: Sparkles }
        ]);
      } finally {
        setCargando(false);
      }
    }
    cargarMenuDesdeBD();
  }, []);

  const productosFiltrados = productosMenu.filter(producto => {
    const catProducto = producto.categoria ? producto.categoria.toLowerCase() : '';
    
    let coincideCategoria = false;
    if (categoriaActiva === 'todos') {
      coincideCategoria = true;
    } else if (categoriaActiva === 'promociones') {
      coincideCategoria = producto.en_promocion || producto.enPromocion || catProducto === 'promociones';
    } else {
      coincideCategoria = catProducto === categoriaActiva;
    }

    const nombreProd = producto.nombre || '';
    const descProd = producto.descripcion || '';
    const coincideBusqueda = nombreProd.toLowerCase().includes(busqueda.toLowerCase()) ||
                             descProd.toLowerCase().includes(busqueda.toLowerCase());
                             
    return coincideCategoria && coincideBusqueda;
  }).sort((a, b) => {
    const catA = a.categoria ? a.categoria.toLowerCase() : '';
    const catB = b.categoria ? b.categoria.toLowerCase() : '';
    const esPromoA = a.en_promocion || a.enPromocion || catA === 'promociones';
    const esPromoB = b.en_promocion || b.enPromocion || catB === 'promociones';

    if (esPromoA && !esPromoB) return -1;
    if (!esPromoA && esPromoB) return 1;
    return 0;
  });

  const cantidadTotalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const precioTotalAcumulado = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

  const formatearPrecio = (valor) => {
    return `$ ${(valor || 0).toLocaleString('es-CO')}`;
  };

  // Manejador protegido contra doble invocación
  const handleAgregarClick = (e, producto) => {
    e.preventDefault();
    e.stopPropagation();
    alAgregarAlCarrito(producto);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-neutral-400 text-sm font-medium">Cargando menú de Delicius Burguer...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none pb-28">
       
      {/* HEADER FIJO */}
      <header className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur-md border-b border-neutral-900 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button 
            onClick={alVolverInicio}
            className="flex items-center gap-2 text-neutral-400 hover:text-amber-400 bg-neutral-900 hover:bg-neutral-800 px-3 sm:px-4 py-2 rounded-xl border border-neutral-800 transition-all cursor-pointer text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Volver</span>
          </button>

          <div className="text-center">
            <h1 className="text-lg sm:text-xl font-black tracking-wider text-white uppercase">
              DELICIUS<span className="text-amber-500"> BURGUER</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-400 text-xs font-semibold">
            {modoPedido === 'para_servir' && <><UtensilsCrossed className="w-3.5 h-3.5" /><span>Para comer aquí</span></>}
            {modoPedido === 'para_recoger' && <><ShoppingBag className="w-3.5 h-3.5" /><span>Para llevar</span></>}
            {modoPedido === 'domicilio' && <><Bike className="w-3.5 h-3.5" /><span>Domicilio</span></>}
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
         
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Nuestro Menú</h2>
            <p className="text-neutral-400 text-sm">
              Mostrando {productosFiltrados.length} productos disponibles
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-500">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Sección de Categorías con Scroll Horizontal y Controles al Extremo */}
        <div className="flex items-center justify-between gap-2">
          <div 
            ref={scrollContainerRef}
            className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none w-full scroll-smooth"
          >
            {categoriasMenu.map((cat) => {
              const IconoCat = cat.icono || UtensilsCrossed;
              const estaActiva = categoriaActiva === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaActiva(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                    estaActiva 
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-lg shadow-amber-500/20' 
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <IconoCat className={`w-4 h-4 ${estaActiva ? 'text-neutral-950' : 'text-amber-500'}`} />
                  <span>{cat.nombre}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-1 shrink-0 pl-2">
            <button 
              onClick={() => desplazarCategorias('izquierda')}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 rounded-xl border border-neutral-800 transition-all cursor-pointer shadow-md"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => desplazarCategorias('derecha')}
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 rounded-xl border border-neutral-800 transition-all cursor-pointer shadow-md"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuadrícula de Productos */}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900/40 rounded-3xl border border-neutral-900">
            <p className="text-neutral-400 text-base">No hay productos disponibles en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {productosFiltrados.map((producto) => {
              const catProducto = producto.categoria ? producto.categoria.toLowerCase() : '';
              const enPromocion = producto.en_promocion || producto.enPromocion || catProducto === 'promociones';

              return (
                <div 
                  key={producto.id}
                  className={`group relative bg-neutral-900 border rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl overflow-hidden ${
                    enPromocion 
                      ? 'border-red-500/80 shadow-red-500/15 hover:border-red-400 ring-1 ring-red-500/30' 
                      : 'border-neutral-800 hover:border-amber-500/50'
                  }`}
                >
                  {enPromocion && (
                    <span className="absolute top-4 right-4 z-10 bg-red-600/90 backdrop-blur-md border border-red-400 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <Flame className="w-3 h-3" /> En Promoción
                    </span>
                  )}

                  {!enPromocion && producto.popular && (
                    <span className="absolute top-4 right-4 z-10 bg-neutral-950/80 backdrop-blur-md border border-amber-500/40 text-amber-400 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shadow-lg">
                      Popular 🔥
                    </span>
                  )}

                  <div>
                    <div className="w-full h-44 bg-neutral-950 rounded-2xl mb-4 overflow-hidden relative border border-neutral-800">
                      <TarjetaImagen src={producto.imagen} alt={producto.nombre} />
                    </div>

                    <h3 className="font-bold text-lg text-white group-hover:text-amber-400 transition-colors">
                      {producto.nombre}
                    </h3>
                    <p className="text-neutral-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {producto.descripcion}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-800/80">
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase font-semibold">Precio</span>
                      <span className="text-lg font-black text-white">{formatearPrecio(producto.precio)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAgregarClick(e, producto)}
                      className="flex items-center gap-1.5 bg-neutral-950 hover:bg-amber-500 text-amber-400 hover:text-neutral-950 border border-amber-500/30 hover:border-amber-500 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer active:scale-95 shadow-md shadow-amber-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* FOOTER / MARCA DE AGUA */}
      <footer className="text-center text-xs text-neutral-500 py-6 mt-auto">
        Sistema Operado por <span className="font-semibold text-neutral-400">Vertizze</span> © 2026
      </footer>

      {/* FOOTER FLOTANTE DE CARRITO */}
      {cantidadTotalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 shadow-2xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500 text-neutral-950 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-amber-500/20">
                {cantidadTotalItems}
              </div>
              <div>
                <span className="text-xs text-neutral-400 block font-medium">Total del pedido</span>
                <span className="text-lg font-black text-white">{formatearPrecio(precioTotalAcumulado)}</span>
              </div>
            </div>

            <button
              onClick={alIrAlCarrito}
              className="flex items-center gap-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 px-6 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer active:scale-95 shadow-xl shadow-amber-500/25"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Ver Carrito / Pagar</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
