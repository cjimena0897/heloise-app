// Configuración del proyecto de Firebase (Consola de Firebase → ⚙ Configuración del proyecto →
// "Tus apps" → app web → "Configuración del SDK"). Estos datos NO son secretos: el acceso
// lo controlan el inicio de sesión y las reglas de `firestore.rules`.
//
// Mientras `apiKey` esté vacío, la app funciona en modo local (datos solo en este celular).
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
