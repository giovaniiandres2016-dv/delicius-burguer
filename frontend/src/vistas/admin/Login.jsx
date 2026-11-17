// ============================================================================
// ARCHIVO: src/vistas/Login.jsx
// DESCRIPCIÓN: Pantalla de selección de rol y autenticación por usuario (Admin y Cocina).
// ============================================================================

import React, { useState } from 'react';
import { ChefHat, ShieldCheck, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../sdk/supabaseClient';

export default function Login({ alIniciarSesion }) {
  const [modo, setModo] = useState('seleccion'); // 'seleccion', 'admin_form' o 'cocina_form'
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const manejarLoginAdmin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      const { data, error: err } = await supabase
        .from('usuarios_admin')
        .select('*')
        .eq('usuario', usuario.trim())
        .eq('password', password.trim())
        .single();

      if (err || !data) {
        throw new Error('Usuario o contraseña incorrectos.');
      }

      // Guardamos sesión local completa y enviamos rol administrador
      localStorage.setItem('vertizze_sesion', JSON.stringify(data));
      alIniciarSesion(data.rol || 'administrador');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const manejarLoginCocina = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      const { data, error: err } = await supabase
        .from('usuarios_admin')
        .select('*')
        .eq('usuario', usuario.trim())
        .eq('password', password.trim())
        .single();

      if (err || !data) {
        throw new Error('Usuario o contraseña incorrectos.');
      }

      // Validar que el usuario tenga rol de cocina
      const rolUsuario = (data.rol || '').toLowerCase();
      if (rolUsuario !== 'cocina' && rolUsuario !== 'administrador') {
        throw new Error('Este usuario no tiene permisos autorizados para el Módulo de Cocina.');
      }

      // Guardar sesión forzando el rol de cocina si el usuario es de cocina
      const rolFinal = rolUsuario === 'cocina' ? 'cocina' : (data.rol || 'administrador');
      localStorage.setItem('vertizze_sesion', JSON.stringify({ ...data, rol: rolFinal }));
      localStorage.setItem('rol_vertizze', rolFinal);
      
      alIniciarSesion(rolFinal);
    } catch (err) {
      setError(err.message || 'Error al autenticar en cocina');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Cabecera */}
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 mx-auto shadow-inner">
            <ChefHat className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Sistema Gastronómico</h1>
          <p className="text-xs text-neutral-400">Selecciona tu módulo de trabajo</p>
        </div>

        {modo === 'seleccion' ? (
          <div className="space-y-4">
            <button
              onClick={() => { setModo('admin_form'); setUsuario(''); setPassword(''); setError(''); }}
              className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 p-4 rounded-2xl flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Administrador</h3>
                  <p className="text-xs text-neutral-400">Dashboard, contabilidad, menú y reportes</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => { setModo('cocina_form'); setUsuario(''); setPassword(''); setError(''); }}
              className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 p-4 rounded-2xl flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Módulo de Cocina (KDS)</h3>
                  <p className="text-xs text-neutral-400">Acceso seguro a la cola de pedidos</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        ) : modo === 'admin_form' ? (
          <form onSubmit={manejarLoginAdmin} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Acceso Administrador</h2>
              <button 
                type="button" 
                onClick={() => setModo('seleccion')} 
                className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
              >
                Volver
              </button>
            </div>

            {error && (
              <div className="bg-red-950/80 border border-red-500/40 text-red-200 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Usuario</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="Ej. admin"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer mt-4"
            >
              {cargando ? 'Verificando...' : 'Ingresar al Dashboard'}
            </button>
          </form>
        ) : (
          <form onSubmit={manejarLoginCocina} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Acceso Módulo de Cocina (KDS)</h2>
              <button 
                type="button" 
                onClick={() => setModo('seleccion')} 
                className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
              >
                Volver
              </button>
            </div>

            {error && (
              <div className="bg-red-950/80 border border-red-500/40 text-red-200 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Usuario de Cocina</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="Ej. cocina1"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">Contraseña / PIN</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer mt-4"
            >
              {cargando ? 'Verificando...' : 'Ingresar a Cocina (KDS)'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
