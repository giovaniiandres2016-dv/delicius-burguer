// ============================================================================
// ARCHIVO: src/sdk/supabaseClient.js
// DESCRIPCIÓN: Cliente de Supabase conectado a Delicius Burguer (flirnmtgxfnvtiecbzzm)
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// Leemos las variables directamente de Vite o utilizamos los respaldos oficiales del proyecto
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const urlFinal = supabaseUrl || "https://flirnmtgxfnvtiecbzzm.supabase.co";
const keyFinal = supabaseAnonKey || "sb_publishable_j96S61DH_nVPgJFjRAS79A_8fuzK_Lh";

export const supabase = createClient(urlFinal, keyFinal);