import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
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


/**
 * Format pesan error Firebase Auth ke Bahasa Indonesia yang jelas dan aman
 */
function parseFirebaseAuthError(code: string, originalMessage: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Email atau kata sandi salah. Silakan periksa kembali atau pastikan akun sudah terdaftar.'
    case 'auth/user-not-found':
      return 'Akun belum terdaftar. Silakan daftarkan akun terlebih dahulu di Firebase Authentication.'
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.'
    case 'auth/email-already-in-use':
      return 'Alamat email sudah terdaftar.'
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah (minimal 6 karakter).'
    case 'auth/too-many-requests':
      return 'Akses diblokir sementara karena terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.'
    case 'auth/operation-not-allowed':
      return 'Metode login Email/Password belum diaktifkan di Firebase Console (buka Authentication > Sign-in method > Email/Password).'
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.'
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan oleh administrator.'
    default:
      return originalMessage || 'Terjadi kesalahan autentikasi.'
  }
}

/**
 * Login khusus Admin LIVEin - Validasi murni Firebase Authentication
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

  if (!isFirebaseConfigured) {
    return {
      data: null,
      error: new Error(
        'Konfigurasi Firebase belum lengkap di server.'
      ),
    }
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password
    )

    if (!userCredential?.user) {
      return { data: null, error: new Error('Akun tidak ditemukan atau tidak valid.') }
    }

    return { data: userCredential, error: null }
  } catch (err: any) {
    const errorCode = err?.code || ''
    return {
      data: null,
      error: new Error(parseFirebaseAuthError(errorCode, err?.message)),
    }
  }
}

/**
 * Logout admin resmi
 */
export async function signOutAdmin() {
  localStorage.removeItem('livein_demo_admin_session')
  if (isFirebaseConfigured) {
    try {
      await signOut(auth)
    } catch (e) {
      console.warn('Firebase signOut warning:', e)
    }
  }
}

/**
 * Listener status autentikasi admin resmi Firebase Auth
 */
export function onAdminAuthStateChanged(callback: (user: User | null) => void) {
  if (isFirebaseConfigured) {
    return onAuthStateChanged(auth, (user) => {
      callback(user)
    })
  }

  callback(null)
  return () => {}
}
