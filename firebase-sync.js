// ============================================================
// FIREBASE SYNC - Sincronización de datos con Firestore (Firebase 8.x)
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

let currentUser = null;
let syncInProgress = false;

// Detectar cambios de autenticación
auth.onAuthStateChanged(function(user) {
  currentUser = user;
  if (user) {
    console.log('✓ Usuario autenticado:', user.email);
    loadDataFromFirestore();
  } else {
    console.log('Usuario no autenticado');
  }
});

// ============================================================
// GUARDAR Y CARGAR DATOS
// ============================================================

function saveToFirestore(key, value) {
  if (!currentUser || syncInProgress) return;

  try {
    syncInProgress = true;
    const userData = currentUser.uid;

    db.collection('users').doc(userData).collection('data').doc(key).set({
      value: value,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sync: true
    }).then(function() {
      console.log('✓ Guardado en Firestore: ' + key);
    }).catch(function(error) {
      console.error('Error al guardar en Firestore (' + key + '):', error);
    }).finally(function() {
      syncInProgress = false;
    });
  } catch (error) {
    console.error('Error:', error);
    syncInProgress = false;
  }
}

function loadDataFromFirestore() {
  if (!currentUser) return;

  try {
    const userData = currentUser.uid;
    db.collection('users').doc(userData).collection('data').get().then(function(snapshot) {
      snapshot.forEach(function(doc) {
        var value = doc.data().value;
        localStorage.setItem(doc.id, JSON.stringify(value));
      });
      console.log('✓ Datos cargados desde Firestore');
    }).catch(function(error) {
      console.error('Error al cargar datos de Firestore:', error);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Interceptar setItem
var originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  originalSetItem.call(this, key, value);

  if (!key.startsWith('_') && currentUser) {
    try {
      saveToFirestore(key, JSON.parse(value));
    } catch (e) {
      saveToFirestore(key, value);
    }
  }
};

// Interceptar getItem
var originalGetItem = Storage.prototype.getItem;
Storage.prototype.getItem = function(key) {
  return originalGetItem.call(this, key);
};

// ============================================================
// SINCRONIZACIÓN EN TIEMPO REAL
// ============================================================

function setupRealtimeSync() {
  if (!currentUser) return;

  var userData = currentUser.uid;

  db.collection('users').doc(userData).collection('data').onSnapshot(function(snapshot) {
    snapshot.docChanges().forEach(function(change) {
      if (change.type === 'added' || change.type === 'modified') {
        var key = change.doc.id;
        var value = change.doc.data().value;
        localStorage.setItem(key, JSON.stringify(value));
        console.log('✓ Sincronizado desde Firestore: ' + key);
      }
    });
  });
}

auth.onAuthStateChanged(function(user) {
  if (user) {
    setupRealtimeSync();
  }
});

// ============================================================
// AUTENTICACIÓN ANÓNIMA
// ============================================================

function loginAnonymously() {
  auth.signInAnonymously().then(function(result) {
    console.log('✓ Sesión anónima iniciada');
    return result.user;
  }).catch(function(error) {
    console.error('Error al iniciar sesión anónima:', error);
  });
}

window.addEventListener('load', function() {
  if (!auth.currentUser) {
    loginAnonymously();
  }
});

// ============================================================
// FUNCIONES GLOBALES
// ============================================================

window.FirebaseSync = {
  saveToFirestore: saveToFirestore,
  loadDataFromFirestore: loadDataFromFirestore,
  setupRealtimeSync: setupRealtimeSync,
  loginAnonymously: loginAnonymously,
  getCurrentUser: function() { return currentUser; },
  getFirestore: function() { return db; },
  getAuth: function() { return auth; }
};

console.log('✓ Firebase Sync iniciado - todos los datos se guardan automáticamente');
