// ============================================================
// FIREBASE SYNC - Sincronización de datos con Firestore
// ============================================================
// Este archivo reemplaza localStorage con Firestore
// Todos los datos se guardan automáticamente en la nube

const firebaseConfig = {
  apiKey: "AIzaSyBVpBEJtstCzLqOa6Zur7rhaDgXekoNjzg",
  authDomain: "aparch-raices.firebaseapp.com",
  projectId: "aparch-raices",
  storageBucket: "aparch-raices.firebasestorage.app",
  messagingSenderId: "602829013427",
  appId: "1:602829013427:web:598dba2f052e93625f8bc6",
  measurementId: "G-8FT7T6ZKN2"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('✓ Firebase inicializado correctamente');

// ============================================================
// INTERCEPTAR LOCALSTORAGE
// ============================================================
// Cualquier dato que se guarde en localStorage se sincroniza con Firestore

let currentUser = null;
let syncInProgress = false;

// Detectar cambios de autenticación
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    console.log('✓ Usuario autenticado:', user.email);
    // Cargar datos de Firestore al iniciar sesión
    loadDataFromFirestore();
  } else {
    console.log('Usuario no autenticado');
  }
});

// ============================================================
// REEMPLAZAR FUNCIONES DE LOCALSTORAGE
// ============================================================

// Guardar datos en Firestore
async function saveToFirestore(key, value) {
  if (!currentUser || syncInProgress) return;

  try {
    syncInProgress = true;
    const userData = currentUser.uid;

    await db.collection('users').doc(userData).collection('data').doc(key).set({
      value: value,
      timestamp: new Date(),
      sync: true
    });

    console.log(`✓ Guardado en Firestore: ${key}`);
  } catch (error) {
    console.error(`Error al guardar en Firestore (${key}):`, error);
  } finally {
    syncInProgress = false;
  }
}

// Cargar datos de Firestore
async function loadDataFromFirestore() {
  if (!currentUser) return;

  try {
    const userData = currentUser.uid;
    const snapshot = await db.collection('users').doc(userData).collection('data').get();

    snapshot.forEach(doc => {
      const value = doc.data().value;
      // Guardar en localStorage también para acceso rápido
      localStorage.setItem(doc.id, JSON.stringify(value));
    });

    console.log('✓ Datos cargados desde Firestore');
  } catch (error) {
    console.error('Error al cargar datos de Firestore:', error);
  }
}

// Interceptar setItem
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  originalSetItem.call(this, key, value);

  // No sincronizar claves internas
  if (!key.startsWith('_') && currentUser) {
    try {
      saveToFirestore(key, JSON.parse(value));
    } catch (e) {
      // Si no es JSON, guardar como string
      saveToFirestore(key, value);
    }
  }
};

// Interceptar getItem
const originalGetItem = Storage.prototype.getItem;
Storage.prototype.getItem = function(key) {
  return originalGetItem.call(this, key);
};

// ============================================================
// SINCRONIZACIÓN EN TIEMPO REAL
// ============================================================

function setupRealtimeSync() {
  if (!currentUser) return;

  const userData = currentUser.uid;

  // Escuchar cambios en Firestore
  db.collection('users').doc(userData).collection('data').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const key = change.doc.id;
        const value = change.doc.data().value;
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`✓ Sincronizado desde Firestore: ${key}`);
      }
    });
  });
}

// Iniciar sincronización cuando el usuario inicia sesión
auth.onAuthStateChanged(user => {
  if (user) {
    setupRealtimeSync();
  }
});

// ============================================================
// FUNCIONES DE AUTENTICACIÓN ANÓNIMA (para usuario por defecto)
// ============================================================

async function loginAnonymously() {
  try {
    const result = await auth.signInAnonymously();
    console.log('✓ Sesión anónima iniciada');
    return result.user;
  } catch (error) {
    console.error('Error al iniciar sesión anónima:', error);
  }
}

// Auto-login anónimo si no hay usuario autenticado
window.addEventListener('load', () => {
  if (!auth.currentUser) {
    loginAnonymously();
  }
});

// ============================================================
// HACER FUNCIONES DISPONIBLES GLOBALMENTE
// ============================================================

window.FirebaseSync = {
  saveToFirestore,
  loadDataFromFirestore,
  setupRealtimeSync,
  loginAnonymously,
  getCurrentUser: () => currentUser,
  getFirestore: () => db,
  getAuth: () => auth
};

console.log('✓ Firebase Sync iniciado - todos los datos se guardan automáticamente');