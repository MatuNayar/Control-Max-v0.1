/**
 * CONTROL-MAX - Capa de Datos (Firebase Realtime Database)
 * =========================================================
 * Reemplaza a localStorage. Características:
 *   - Carga PEREZOSA (lazy): cada colección se trae de Firebase la primera vez
 *     que se necesita (al entrar a la sección que la usa), no al arrancar.
 *   - TIEMPO REAL: al traer una colección se deja un listener vivo; los cambios
 *     hechos en otra PC actualizan la caché y re-renderizan solos.
 *   - Caché en memoria: las lecturas (DB.get) son síncronas como antes.
 *   - Escritura write-through: DB.set actualiza la caché al instante y persiste
 *     en Firebase de forma asíncrona.
 *
 *  >>> IMPORTANTE: pegá la configuración de TU proyecto Firebase abajo. <<<
 *      (Consola Firebase -> Config del proyecto -> Tus apps -> Web </>)
 */

// ============================================================
//  CONFIGURACIÓN DE FIREBASE
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyARgAWVM9VPUx4bAyonH37K5jQBmOvEq4M",
  authDomain: "control-max-55658.firebaseapp.com",
  databaseURL: "https://control-max-55658-default-rtdb.firebaseio.com",
  projectId: "control-max-55658",
  storageBucket: "control-max-55658.firebasestorage.app",
  messagingSenderId: "838894865460",
  appId: "1:838894865460:web:2a3fdbb9db1eee6c5bce61",
  measurementId: "G-1L75YVWELV",
};

// NOTA DE SEGURIDAD: en "modo de prueba" la base queda abierta a internet y la
// app guarda contraseñas en texto plano. Antes de exponer datos reales conviene
// agregar Firebase Authentication + reglas de seguridad de Realtime Database.

const DB = (function () {
  let database = null;

  const cache = {}; // key -> valor ya normalizado (en memoria)
  const loaded = {}; // key -> true cuando ya se cargó al menos una vez
  const loading = {}; // key -> Promise de la carga inicial en curso
  const renderHooks = {}; // key -> función de re-render para cambios remotos

  // Valores por defecto. Para las claves que aparecen acá, si el nodo no existe
  // en Firebase se siembra automáticamente la primera vez. El resto son arrays [].
  const DEFAULTS = {
    balances: { cash: 0, bank: 0 },
    expenseCategories: [
      {
        id: 1,
        name: "Servicios",
        description: "Luz, Agua, Gas, Internet",
        color: "#3498db",
      },
      {
        id: 2,
        name: "Impuestos",
        description: "Cargas impositivas, AFIP",
        color: "#e74c3c",
      },
      {
        id: 3,
        name: "Varios",
        description: "Gastos menores y generales",
        color: "#95a5a6",
      },
    ],
    config: { saleCounter: 0, codeCounters: {} },
    rubroPrefixes: {},
    users: [
      {
        id: 1,
        username: "admin",
        password: "admin",
        role: "admin",
        active: true,
      },
    ],
  };

  // Todas las colecciones que maneja la app (para backup/restore).
  const ALL_KEYS = [
    "products",
    "salesHistory",
    "purchases",
    "quotes",
    "returns",
    "masterRubros",
    "masterMarcas",
    "rubroPrefixes",
    "balances",
    "expenseHistory",
    "expenseCategories",
    "customers",
    "suppliers",
    "offers",
    "combos",
    "losses",
    "printQueue",
    "partners",
    "config",
    "logs",
    "users",
  ];

  // Qué colecciones necesita cada sección / sub-pestaña.
  const SECTION_KEYS = {
    login: ["users"],
    inventory: [
      "products",
      "masterRubros",
      "masterMarcas",
      "offers",
      "combos",
      "losses",
      "printQueue",
      "rubroPrefixes",
      "config",
      "suppliers",
      "partners",
      "purchases",
      "balances",
    ],
    sales: ["products", "customers", "combos", "offers", "config"],
    "sales-quotes": ["quotes"],
    "sales-history": ["salesHistory", "returns"],
    purchases: ["suppliers", "partners", "products", "purchases"],
    balance: ["balances", "expenseHistory", "expenseCategories"],
    accounts: ["customers", "suppliers"],
    partners: ["partners", "products", "balances"],
    reports: [
      "salesHistory",
      "returns",
      "products",
      "expenseHistory",
      "losses",
      "balances",
      "customers",
      "suppliers",
      "expenseCategories",
    ],
    history: ["logs", "users"],
    admin: ["users", "logs"],
  };

  function clone(v) {
    return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v));
  }

  // RTDB rechaza valores undefined; el round-trip JSON los elimina igual que
  // hacía JSON.stringify con localStorage.
  function sanitize(v) {
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  }

  function defaultFor(key) {
    return key in DEFAULTS ? clone(DEFAULTS[key]) : [];
  }

  // ¿Esta clave debería ser un array? (todo lo que no sea balances/config/rubroPrefixes)
  function expectsArray(key) {
    return !(key in DEFAULTS) || Array.isArray(DEFAULTS[key]);
  }

  // Normaliza lo que devuelve RTDB: null -> default; objeto con claves numéricas
  // (o push-ids, ej. logs) -> array.
  function normalize(raw, key) {
    if (raw === null || raw === undefined) return defaultFor(key);
    if (expectsArray(key) && !Array.isArray(raw) && typeof raw === "object") {
      return Object.values(raw);
    }
    return raw;
  }

  function init() {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    return Promise.resolve();
  }

  // Trae la colección (si no estaba) y deja un listener vivo. Devuelve una
  // Promise que resuelve cuando llega el primer valor.
  function ensure(key) {
    if (loaded[key]) return Promise.resolve();
    if (loading[key]) return loading[key];

    loading[key] = new Promise((resolve, reject) => {
      let first = true;
      database.ref(key).on(
        "value",
        (snap) => {
          const raw = snap.val();
          cache[key] = normalize(raw, key);

          if (first) {
            first = false;
            loaded[key] = true;
            // Sembrar el default si el nodo no existía todavía.
            if (raw === null && key in DEFAULTS) {
              database
                .ref(key)
                .set(sanitize(DEFAULTS[key]))
                .catch((e) => console.error("seed", key, e));
            }
            resolve();
          } else if (renderHooks[key]) {
            // Cambio remoto: refrescar la vista correspondiente.
            try {
              renderHooks[key]();
            } catch (e) {
              console.error("onChange", key, e);
            }
          }
        },
        (err) => {
          console.error("Error leyendo", key, err);
          if (first) {
            first = false;
            reject(err);
          }
        },
      );
    });
    return loading[key];
  }

  function ensureMany(keys) {
    return Promise.all((keys || []).map(ensure));
  }

  // Lectura síncrona desde la caché (clon, para conservar la semántica de
  // localStorage donde cada getItem devolvía una copia fresca).
  function get(key, fallback) {
    if (key in cache && cache[key] !== null && cache[key] !== undefined) {
      return clone(cache[key]);
    }
    return fallback !== undefined ? fallback : defaultFor(key);
  }

  // Escritura: actualiza caché al instante + persiste en Firebase (Promise).
  function set(key, value) {
    cache[key] = clone(value);
    loaded[key] = true;
    return database
      .ref(key)
      .set(sanitize(value))
      .catch((e) => {
        console.error("Error guardando", key, e);
        throw e;
      });
  }

  // Agrega un registro sin descargar toda la colección (ideal para logs).
  function push(key, entry) {
    return database
      .ref(key)
      .push(sanitize(entry))
      .catch((e) => console.error("Error en push", key, e));
  }

  // ¿La clave tiene contenido cargado? (reemplaza if(!localStorage.getItem(k)))
  function has(key) {
    const v = cache[key];
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  }

  // Registra la función de re-render para los cambios remotos de una clave.
  function onChange(key, fn) {
    renderHooks[key] = fn;
  }

  // Reemplaza toda la base (restore desde backup).
  async function replaceAll(obj) {
    const updates = {};
    ALL_KEYS.forEach((k) => {
      updates[k] = null;
    }); // limpiar las que no vengan
    for (const k in obj) updates[k] = sanitize(obj[k]);
    await database.ref().set(updates);
  }

  // Borra toda la base (factory reset).
  async function clearAll() {
    await database.ref().remove();
  }

  return {
    init,
    ensure,
    ensureMany,
    get,
    set,
    push,
    has,
    onChange,
    replaceAll,
    clearAll,
    SECTION_KEYS,
    ALL_KEYS,
  };
})();
