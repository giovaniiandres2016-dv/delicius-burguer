// ============================================================================
// ARCHIVO: src/vistas/cliente/PantallaInicio.jsx
// DESCRIPCIÓN: Pantalla principal optimizada sin scroll y adaptativa.
// ============================================================================

import React from 'react';
import { UtensilsCrossed, ShoppingBag, Bike, Zap } from 'lucide-react';

export default function PantallaInicio({ alSeleccionarModo }) {
  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex flex-col justify-between p-3 sm:p-5 overflow-hidden select-none">
      
      {/* Encabezado compacto */}
      <header className="text-center shrink-0">
        <h2 className="text-amber-500 font-bold tracking-widest text-[10px] sm:text-xs uppercase">
          ¡Bienvenidos!
        </h2>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wider mt-0.5 text-white uppercase">
          DELICIUS<span className="text-amber-500"> BURGUER</span>
        </h1>
      </header>

      {/* Contenido Principal Ajustado sin Scroll */}
      <main className="flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 w-full max-w-4xl mx-auto my-auto px-2">
        
        {/* Espacio reservado para el logo del cliente (tamaño optimizado) */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl bg-neutral-900 border-2 border-dashed border-neutral-700 flex items-center justify-center text-neutral-500 text-[11px] text-center p-2 shadow-inner shrink-0">
          {/* Reemplaza este div o añade tu etiqueta <img src="..." alt="Logo" /> cuando lo tengas */}
          <span>[ Logo Cliente ]</span>
        </div>

        <div className="space-y-1.5 max-w-md px-2">
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 text-[11px] sm:text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/25">
            <Zap className="w-3 h-3" /> Pide de forma fácil y rápida
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ¿Con hambre?
          </h2>
          <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
            Sáltate la fila, arma tu pedido a tu gusto y disfrútalo al instante.
          </p>
        </div>

        {/* 3 Opciones de Servicio Compactas y Responsivas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl pt-1">
          
          {/* Para comer aquí */}
          <button 
            onClick={() => alSeleccionarModo('para_servir')}
            className="group relative flex flex-col items-center justify-center p-4 sm:p-5 bg-neutral-900 border-2 border-neutral-800 rounded-2xl sm:rounded-3xl hover:border-amber-500/60 hover:bg-neutral-800/80 transition-all duration-300 shadow-xl active:scale-95 cursor-pointer touch-manipulation"
          >
            <div className="p-3 bg-neutral-950 rounded-xl mb-2 group-hover:bg-amber-500/10 text-amber-500 transition-all duration-300 shadow-md">
              <UtensilsCrossed className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm sm:text-base text-white tracking-tight">PARA COMER AQUÍ</span>
            <span className="text-[11px] text-neutral-400 mt-0.5">Disfruta en el local</span>
          </button>

          {/* Para Llevar */}
          <button 
            onClick={() => alSeleccionarModo('para_recoger')}
            className="group relative flex flex-col items-center justify-center p-4 sm:p-5 bg-neutral-900 border-2 border-neutral-800 rounded-2xl sm:rounded-3xl hover:border-amber-500/60 hover:bg-neutral-800/80 transition-all duration-300 shadow-xl active:scale-95 cursor-pointer touch-manipulation"
          >
            <div className="p-3 bg-neutral-950 rounded-xl mb-2 group-hover:bg-amber-500/10 text-amber-500 transition-all duration-300 shadow-md">
              <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm sm:text-base text-white tracking-tight">PARA LLEVAR</span>
            <span className="text-[11px] text-neutral-400 mt-0.5">Pide y retira en caja</span>
          </button>

          {/* Domicilio */}
          <button 
            onClick={() => alSeleccionarModo('domicilio')}
            className="group relative flex flex-col items-center justify-center p-4 sm:p-5 bg-neutral-900 border-2 border-neutral-800 rounded-2xl sm:rounded-3xl hover:border-amber-500/60 hover:bg-neutral-800/80 transition-all duration-300 shadow-xl active:scale-95 cursor-pointer touch-manipulation"
          >
            <div className="p-3 bg-neutral-950 rounded-xl mb-2 group-hover:bg-amber-500/10 text-amber-500 transition-all duration-300 shadow-md">
              <Bike className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm sm:text-base text-white tracking-tight">DOMICILIO</span>
            <span className="text-[11px] text-neutral-400 mt-0.5">Llega directo a tu puerta</span>
          </button>

        </div>

      </main>

      {/* Pie de página compacto */}
      <footer className="text-center text-[10px] sm:text-xs text-neutral-500 shrink-0 py-1">
        Sistema Operado por <span className="font-semibold text-neutral-400">Vertizze</span> © 2026
      </footer>

    </div>
  );
}