import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

export const ADMIN_EMAIL = 'dedejuniarputra00@gmail.com'
const DEMO_SESSION_KEY = 'livein_demo_admin_session'

/**
 * Format pesan error Firebase Auth ke Bahasa Indonesia yang ramah
 */
function parseFirebaseAuthError(code: string, originalMessage: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email atau kata sandi salah. Silakan periksa kembali.'
    case 'auth/user-not-found':
      return 'Akun belum terdaftar di Firebase.'
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.'
    case 'auth/email-already-in-use':
      return 'Alamat email sudah terdaftar.'
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah (minimal 6 karakter).'
    case 'auth/too-many-requests':
      return 'Akses diblokir sementara karena terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.'
    case 'auth/operation-not-allowed':
      return 'Metode login Email/Password belum diaktifkan di Firebase Console (buka Authentication > Sign-in method > aktifkan Email/Password).'
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.'
    default:
      return originalMessage || 'Terjadi kesalahan autentikasi.'
  }
}

/**
 * Login khusus Admin LIVEin
 */
export async function signInAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    return { data: null, error: new Error('Email dan kata sandi wajib diisi.') }
  }
  if (password.length < 6) {
    return { data: null, error: new Error('Kata sandi minimal 6 karakter.') }
  }
  if (password.length > 128) {
    return { data: null, error: new Error('Kata sandi terlalu panjang.') }
  }
  if (normalizedEmail.length > 254) {
    return { data: null, error: new Error('Email terlalu panjang.') }
  }

  // Jika Firebase belum dikonfigurasi di .env, izinkan login demo sementara
  if (!isFirebaseConfigured) {
    if (normalizedEmail === 'admin@livein.com' || normalizedEmail === ADMIN_EMAIL) {
      const mockUser = {
        uid: 'demo-admin-uid',
        email: normalizedEmail,
        displayName: 'Demo Admin LIVEin',
      }
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(mockUser))
      window.dispatchEvent(new Event('auth-state-changed'))
      return { data: { user: mockUser }, error: null }
    }
    return {
      data: null,
      error: new Error(
        'Firebase belum terhubung di .env. Gunakan email demo: admin@livein.com atau lengkapi config Firebase di .env.'
      ),
    }
  }

  try {
    // 1. Coba login langsung via Firebase Auth
    const userCredential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    )

    return { data: userCredential, error: null }
  } catch (err: any) {
    const errorCode = err?.code || ''

    // 2. Jika akun belum ada di Firebase dan merupakan email admin resmi,
    // buatkan otomatis (auto-provision) agar admin tidak perlu repot add user manual
    if (
      (errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/invalid-credential') &&
      normalizedEmail === ADMIN_EMAIL
    ) {
      try {
        const createCredential = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        )
        return { data: createCredential, error: null }
      } catch (createErr: any) {
        // Jika pembuatan gagal karena sudah terdaftar (misal password salah saat login)
        if (createErr?.code === 'auth/email-already-in-use') {
          return {
            data: null,
            error: new Error('Email atau kata sandi salah. Silakan periksa kembali.'),
          }
        }
        return {
          data: null,
          error: new Error(parseFirebaseAuthError(createErr?.code, createErr?.message)),
        }
      }
    }

    return {
      data: null,
      error: new Error(parseFirebaseAuthError(errorCode, err?.message)),
    }
  }
}

/**
 * Logout admin
 */
export async function signOutAdmin() {
  localStorage.removeItem(DEMO_SESSION_KEY)
  window.dispatchEvent(new Event('auth-state-changed'))
  if (isFirebaseConfigured) {
    try {
      await signOut(auth)
    } catch (e) {
      console.warn('Firebase signOut warning:', e)
    }
  }
}

/**
 * Listener status autentikasi admin
 */
export function onAdminAuthStateChanged(callback: (user: User | { uid: string; email: string } | null) => void) {
  // Cek demo session terlebih dahulu jika belum/tidak terhubung
  const checkDemoUser = () => {
    try {
      const demo = localStorage.getItem(DEMO_SESSION_KEY)
      if (demo) return JSON.parse(demo)
    } catch {
      // ignore
    }
    return null
  }

  const handler = () => {
    const demo = checkDemoUser()
    if (demo) {
      callback(demo)
    } else if (!isFirebaseConfigured) {
      callback(null)
    }
  }

  window.addEventListener('auth-state-changed', handler)

  if (isFirebaseConfigured) {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        callback(user)
      } else {
        const demo = checkDemoUser()
        callback(demo)
      }
    })

    return () => {
      window.removeEventListener('auth-state-changed', handler)
      unsubscribe()
    }
  }

  // Jika belum configured, langsung trigger state awal
  callback(checkDemoUser())
  return () => {
    window.removeEventListener('auth-state-changed', handler)
  }
}
