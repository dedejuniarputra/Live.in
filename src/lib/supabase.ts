import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://azecuvgsnbetvzzyypnh.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3c6PNmfWhhZjniobVawY1g_uC2diAUx'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ADMIN_EMAIL = 'dedejuniarputra00@gmail.com'

/**
 * Login khusus untuk akun Admin
 */
export async function signInAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  // 1. Coba login langsung via Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  // 2. Jika akun belum terdaftar di database Supabase,
  // daftarkan secara otomatis (auto-provision) dengan role admin!
  if (
    error &&
    (error.message.includes('Invalid login credentials') ||
      error.message.includes('User not found'))
  ) {
    if (normalizedEmail === ADMIN_EMAIL) {
      // Auto-signup akun admin utama
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              role: 'admin',
              name: 'Admin LIVEin',
            },
          },
        })

      if (!signUpError && signUpData.user) {
        // Jika auto confirm aktif dan session langsung terbentuk
        if (signUpData.session) {
          return { data: signUpData, error: null }
        }

        // Coba login ulang jika user sudah created
        const retrySignIn = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (retrySignIn.data?.session) {
          return { data: retrySignIn.data, error: null }
        }

        // Jika project Supabase mewajibkan konfirmasi link email
        return {
          data: null,
          error: new Error(
            'Akun admin baru saja dibuat di Supabase! Jika Supabase mengaktifkan verifikasi email, silakan periksa inbox/spam dedejuniarputra00@gmail.com atau buat user langsung di Dashboard Supabase (Authentication -> Users -> Add User dengan opsi Auto Confirm).'
          ),
        }
      }

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('rate limit')) {
          return {
            data: null,
            error: new Error(
              'Batas pengiriman email Supabase tercapai (rate limit). Silakan buat user secara instan di Supabase Dashboard: buka Authentication > Users > Add user > Create user, masukkan email & password lalu centang "Auto Confirm User?". Setelah itu coba login kembali.'
            ),
          }
        }
        return { data: null, error: signUpError }
      }
    }
  }

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        data: null,
        error: new Error(
          'Email belum dikonfirmasi di Supabase. Buka Supabase Dashboard > Authentication > Users > cari dedejuniarputra00@gmail.com > pilih Auto-Confirm User atau matikan "Confirm email" di menu Authentication > Providers > Email.'
        ),
      }
    }
    if (error.message.toLowerCase().includes('rate limit')) {
      return {
        data: null,
        error: new Error(
          'Batas pengiriman email Supabase tercapai (rate limit). Silakan buat user langsung di Supabase Dashboard (Authentication > Users > Add user > Create user dengan Auto Confirm dicentang) agar bisa login tanpa menunggu.'
        ),
      }
    }
    return { data: null, error }
  }

  // 3. Verifikasi role admin
  const role =
    data.user?.user_metadata?.role ||
    (normalizedEmail === ADMIN_EMAIL ? 'admin' : null)

  if (role !== 'admin') {
    await supabase.auth.signOut()
    return {
      data: null,
      error: new Error('Akses ditolak: Akun ini tidak memiliki hak akses Admin.'),
    }
  }

  return { data, error: null }
}

/**
 * Logout admin
 */
export async function signOutAdmin() {
  await supabase.auth.signOut()
}

/**
 * Ambil sesi user saat ini
 */
export async function getAdminSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
