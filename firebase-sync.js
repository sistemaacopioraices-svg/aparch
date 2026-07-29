// ============================================================
// FIREBASE SYNC v3 - Sincronización SEGURA en Firestore
// ============================================================
// Guarda TODA la base de datos (DB) completa en Firestore
// Recupera automáticamente al cargar

const firebaseConfig = {
  apiKey: "AIzaSyBVpBEJtstCzLqOa6Zur7rhaDgXekoNjzg",
  authDomain: "aparch-raices.firebaseapp.com",
  projectId: "aparch-raices",
  storageBucket: "aparch-raices.firebasestorage.app",
  messagingSenderId: "602829013427",
  appId: "1:602829013427:web:598dba2f052e93625f8bc6",
  measurementId: "G-8FT7T6ZKN2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('✓ Firebase inicializado correctamente');

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = null;
let syncInProgress = false;
let syncTimer = null;
const SYNC_DELAY = 2000; // Guardar cada 2 segundos (debounce)

// ============================================================
// AUTENTICACIÓN
// ============================================================

auth.onAuthStateChanged(async function(user) {
  currentUser = user;
  if (user) {
    console.log('✓ Usuario autenticado:', user.uid);
    await cargarBaseDatosDesdeFirestore();
  } else {
    console.log('Usuario no autenticado - usando datos locales');
  }
});

// Iniciar sesión anónima automáticamente
auth.onAuthStateChanged(function(user) {
  if (!user) {
    auth.signInAnonymously().catch(error => {
      console.warn('⚠️ No se pudo iniciar sesión anónima:', error.message);
    });
  }
});

// ============================================================
// CARGAR BASE DE DATOS DESDE FIRESTORE
// ============================================================

async function cargarBaseDatosDesdeFirestore() {
  if (!currentUser) return;

  try {
    const userId = currentUser.uid;
    const docRef = db.collection('users').doc(userId).collection('data').doc('database');
    const doc = await docRef.get();

    if (doc.exists) {
      const datosFirestore = doc.data().contenido;

      // Recuperar toda la DB desde Firestore
      if (datosFirestore && typeof datosFirestore === 'object') {
        Object.assign(DB, datosFirestore);
        console.log('✓ Base de datos cargada desde Firestore');
        console.log('  Guías:', DB.guias ? DB.guias.length : 0);
        console.log('  Tickets:', DB.tickets ? DB.tickets.length : 0);
        console.log('  Comprobantes:', DB.comprobantes ? DB.comprobantes.length : 0);

        // Guardar en localStorage también
        localStorage.setItem('DB_backup', JSON.stringify(datosFirestore));
      }
    } else {
      console.log('ℹ️ Primera vez - no hay datos en Firestore');
      // Usar datos locales que ya tiene en localStorage
    }
  } catch (error) {
    console.error('❌ Error cargando desde Firestore:', error);
  }
}

// ============================================================
// GUARDAR BASE DE DATOS EN FIRESTORE (Debounce)
// ============================================================

function guardarBaseDatosEnFirestore() {
  if (!currentUser || syncInProgress) return;

  // Cancelar timer anterior si existe
  if (syncTimer) clearTimeout(syncTimer);

  // Esperar a que terminen los cambios (debounce 2 segundos)
  syncTimer = setTimeout(async () => {
    if (syncInProgress) return;

    try {
      syncInProgress = true;
      const userId = currentUser.uid;

      // Guardar TODA la DB completa
      const datosAGuardar = {
        campana: DB.campana || null,
        tickets: DB.tickets || [],
        guias: DB.guias || [],
        comprobantes: DB.comprobantes || [],
        recibos: DB.recibos || [],
        aperturas: DB.aperturas || [],
        socios: DB.socios || [],
        inspecciones: DB.inspecciones || [],
        prestamos: DB.prestamos || [],
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('users')
        .doc(userId)
        .collection('data')
        .doc('database')
        .set({
          contenido: datosAGuardar,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log('✓ Base de datos guardada en Firestore');
      syncInProgress = false;
    } catch (error) {
      console.error('❌ Error guardando en Firestore:', error);
      syncInProgress = false;
    }
  }, SYNC_DELAY);
}

// ============================================================
// INTERCEPTAR CAMBIOS EN LA BASE DE DATOS
// ============================================================

// Guardar cuando se modifica DB.guias
const originalGuiasPush = DB.guias ? DB.guias.push.bind(DB.guias) : null;
const originalGuiasSlice = DB.guias ? DB.guias.slice.bind(DB.guias) : null;

// Vigilar cambios en la base de datos global
const handler = {
  set: function(target, property, value) {
    target[property] = value;
    // Guardar cuando cambia algo importante
    if (['guias', 'tickets', 'comprobantes', 'recibos', 'aperturas'].includes(property)) {
      guardarBaseDatosEnFirestore();
    }
    return true;
  }
};

// Crear proxy para DB si no existe
if (typeof DB !== 'undefined' && !DB.hasOwnProperty('_proxy')) {
  const DBProxy = new Proxy(DB, handler);
  // Reemplazar DB con el proxy
  window.DB = Object.assign(DB, DBProxy);
}

// ============================================================
// GUARDAR AL HACER CLIC EN "GUARDAR"
// ============================================================

// Interceptar funciones de guardar
const funcionesGuardar = [
  'guardarTicket',
  'guardarGuia',
  'guardarRemision',
  'guardarLiquidacion',
  'guardarFactura',
  'guardarComprobante',
  'guardarApertura',
  'guardarSocio'
];

funcionesGuardar.forEach(nombreFuncion => {
  if (window[nombreFuncion]) {
    const funcionOriginal = window[nombreFuncion];
    window[nombreFuncion] = function(...args) {
      const resultado = funcionOriginal.apply(this, args);
      // Guardar después de cualquier acción de guardar
      setTimeout(() => guardarBaseDatosEnFirestore(), 500);
      return resultado;
    };
  }
});

// ============================================================
// SINCRONIZACIÓN CADA VEZ QUE SE IMPORTA DATOS
// ============================================================

const funcionesImportar = [
  'importarGuiasCompletasExcel',
  'importarGuiasRemisionExcel',
  'importarLiquidacionesExcel',
  'importarFacturasExcel'
];

funcionesImportar.forEach(nombreFuncion => {
  if (window[nombreFuncion]) {
    const funcionOriginal = window[nombreFuncion];
    window[nombreFuncion] = function(...args) {
      const resultado = funcionOriginal.apply(this, args);
      // Guardar después de importar
      setTimeout(() => guardarBaseDatosEnFirestore(), 1000);
      return resultado;
    };
  }
});

// ============================================================
// SINCRONIZACIÓN EN TIEMPO REAL (opcional)
// ============================================================

function setupRealtimeSync() {
  if (!currentUser) return;

  const userId = currentUser.uid;

  // Escuchar cambios en Firestore (desde otros dispositivos)
  db.collection('users')
    .doc(userId)
    .collection('data')
    .doc('database')
    .onSnapshot(function(doc) {
      if (doc.exists) {
        const datosRemoto = doc.data().contenido;
        const datosLocal = {
          tickets: DB.tickets || [],
          guias: DB.guias || [],
          comprobantes: DB.comprobantes || []
        };

        // Solo cargar si los datos remotos son más recientes o más completos
        const countRemoto = (datosRemoto.guias || []).length;
        const countLocal = datosLocal.guias.length;

        if (countRemoto > countLocal) {
          console.log('✓ Sincronizado desde Firestore (otro dispositivo)');
          Object.assign(DB, datosRemoto);
        }
      }
    });
}

// Iniciar sincronización en tiempo real cuando el usuario se autentica
auth.onAuthStateChanged(function(user) {
  if (user) {
    setTimeout(() => setupRealtimeSync(), 1000);
  }
});

// ============================================================
// FUNCIONES PÚBLICAS
// ============================================================

window.FirebaseSync = {
  guardarAhora: guardarBaseDatosEnFirestore,
  cargarAhora: cargarBaseDatosDesdeFirestore,
  getCurrentUser: function() { return currentUser; },
  getFirestore: function() { return db; },
  getAuth: function() { return auth; },
  getStatus: function() {
    return {
      usuario: currentUser ? currentUser.uid : 'anónimo',
      guias: DB.guias ? DB.guias.length : 0,
      tickets: DB.tickets ? DB.tickets.length : 0,
      comprobantes: DB.comprobantes ? DB.comprobantes.length : 0,
      sincronizando: syncInProgress
    };
  }
};

console.log('✓ Firebase Sync v3 iniciado - Base de datos guardada automáticamente en Firestore');
