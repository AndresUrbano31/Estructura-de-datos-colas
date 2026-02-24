/**
 * ============================================================
 *  CASO DE ESTUDIO: Cola de Impresión en el Salón de Clases
 * ============================================================
 *
 *  CONTEXTO:
 *  8 estudiantes comparten una sola impresora en el aula.
 *  Todos envían sus documentos a imprimir casi al mismo tiempo.
 *  El sistema los atiende en orden de llegada (FIFO).
 *  El profesor puede insertar su trabajo con prioridad alta.
 *
 *  CONCEPTOS DE POO APLICADOS:
 *  - Encapsulamiento : atributos private en Node, Queue y PrintQueue
 *  - Abstracción     : el usuario solo llama enqueue() y procesarCola()
 *  - Composición     : PrintQueue contiene una Queue<PrintJob>
 *  - Genericidad     : Queue<T> reutilizable con cualquier tipo
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────────────────────

/** Nivel de prioridad del trabajo */
type Prioridad = "alta" | "normal";

/** Estado del trabajo en el spooler */
type EstadoTrabajo = "en_espera" | "imprimiendo" | "completado";

/** Representa un documento enviado a imprimir */
interface TrabajoImpresion {
  id: string;               // Identificador único del trabajo
  estudiante: string;       // Nombre del estudiante
  documento: string;        // Nombre del archivo
  paginas: number;          // Cantidad de páginas
  prioridad: Prioridad;     // Normal o alta (profesor)
  horaEnvio: string;        // Hora en que se envió a imprimir
  estado: EstadoTrabajo;    // Estado actual del trabajo
  tiempoImpresionMs?: number; // Cuánto tardó en imprimirse
}

/** Parámetros para crear un nuevo trabajo */
type NuevoTrabajo = Omit<TrabajoImpresion, "id" | "estado" | "tiempoImpresionMs">;

/** Estadísticas finales de la sesión */
interface EstadisticasSesion {
  totalTrabajos: number;
  completados: number;
  paginasTotales: number;
  tiempoPromedioMs: number;
  ordenDeAtencion: string[];
}

// ─────────────────────────────────────────────────────────────
//  NODO — Unidad básica de la lista enlazada
// ─────────────────────────────────────────────────────────────

class Nodo<T> {
  valor: T;
  siguiente: Nodo<T> | null = null;

  constructor(valor: T) {
    this.valor = valor;
  }
}

// ─────────────────────────────────────────────────────────────
//  COLA GENÉRICA (FIFO) con soporte de prioridad
//  - enqueue()        O(1) — agrega al final
//  - enqueueFrente()  O(1) — agrega al frente (prioridad alta)
//  - dequeue()        O(1) — saca del frente
//  - peek()           O(1) — consulta sin sacar
// ─────────────────────────────────────────────────────────────

class Cola<T> {
  private cabeza: Nodo<T> | null = null;
  private cola: Nodo<T> | null = null;
  private _tamanio: number = 0;

  /** Agrega un elemento al FINAL — orden normal FIFO */
  encolar(valor: T): void {
    const nodo = new Nodo(valor);
    if (this.cola) {
      this.cola.siguiente = nodo;
    }
    this.cola = nodo;
    if (!this.cabeza) {
      this.cabeza = nodo;
    }
    this._tamanio++;
  }

  /**
   * Agrega un elemento al FRENTE — para trabajos de alta prioridad.
   * El trabajo se inserta justo después del que está imprimiéndose
   * actualmente (no se puede interrumpir el trabajo en curso).
   */
  encolarAlFrente(valor: T): void {
    const nodo = new Nodo(valor);
    nodo.siguiente = this.cabeza;
    this.cabeza = nodo;
    if (!this.cola) {
      this.cola = nodo;
    }
    this._tamanio++;
  }

  /** Saca y retorna el elemento del FRENTE — O(1) */
  desencolar(): T | undefined {
    if (!this.cabeza) return undefined;
    const valor = this.cabeza.valor;
    this.cabeza = this.cabeza.siguiente;
    if (!this.cabeza) this.cola = null;
    this._tamanio--;
    return valor;
  }

  /** Consulta el frente sin sacarlo — O(1) */
  verPrimero(): T | undefined {
    return this.cabeza?.valor;
  }

  get tamanio(): number {
    return this._tamanio;
  }

  get estaVacia(): boolean {
    return this._tamanio === 0;
  }

  /** Convierte la cola a array para mostrar en consola */
  aArreglo(): T[] {
    const resultado: T[] = [];
    let actual = this.cabeza;
    while (actual) {
      resultado.push(actual.valor);
      actual = actual.siguiente;
    }
    return resultado;
  }
}

// ─────────────────────────────────────────────────────────────
//  SPOOLER DE IMPRESIÓN — Caso de estudio principal
// ─────────────────────────────────────────────────────────────

class SpoolerImpresion {
  /** Cola interna de trabajos pendientes */
  private cola: Cola<TrabajoImpresion> = new Cola();

  /** Historial de todos los trabajos procesados */
  private historial: TrabajoImpresion[] = [];

  /** Contador para generar IDs únicos */
  private contadorId: number = 0;

  /** Velocidad de impresión: ms por página */
  private readonly MS_POR_PAGINA = 500;

  /**
   * Recibe un nuevo trabajo de impresión.
   * Si tiene prioridad ALTA (ej: el profesor), se inserta
   * al frente de la cola sin interrumpir el trabajo actual.
   * Si tiene prioridad NORMAL, va al final de la cola.
   */
  enviarAImprimir(datos: NuevoTrabajo): TrabajoImpresion {
    const trabajo: TrabajoImpresion = {
      ...datos,
      id: `DOC-${String(++this.contadorId).padStart(3, "0")}`,
      estado: "en_espera",
    };

    if (trabajo.prioridad === "alta") {
      this.cola.encolarAlFrente(trabajo);
      console.log(
        `🔴 [PRIORIDAD] ${trabajo.estudiante} → "${trabajo.documento}" ` +
        `(${trabajo.paginas} pág.) insertado al FRENTE de la cola`
      );
    } else {
      this.cola.encolar(trabajo);
      console.log(
        `📄 [RECIBIDO]  ${trabajo.estudiante} → "${trabajo.documento}" ` +
        `(${trabajo.paginas} pág.) agregado a la cola | posición: ${this.cola.tamanio}`
      );
    }

    this.historial.push(trabajo);
    return trabajo;
  }

  /**
   * Procesa todos los trabajos en la cola uno a uno.
   * Simula el tiempo de impresión según la cantidad de páginas.
   */
  async procesarCola(): Promise<void> {
    console.log("\n🖨️  ══════════════════════════════════════════════");
    console.log("    IMPRESORA LISTA — Comenzando a procesar cola");
    console.log("    ══════════════════════════════════════════════\n");

    while (!this.cola.estaVacia) {
      const trabajo = this.cola.desencolar()!;

      // Mostrar quién sigue en la fila
      this.mostrarColaActual();

      // Cambiar estado a imprimiendo
      trabajo.estado = "imprimiendo";
      console.log(
        `\n⚙️  [IMPRIMIENDO] ${trabajo.id} | ${trabajo.estudiante} | ` +
        `"${trabajo.documento}" | ${trabajo.paginas} página(s)...`
      );

      // Simular tiempo de impresión (500ms por página)
      const tiempoTotal = trabajo.paginas * this.MS_POR_PAGINA;
      await esperar(tiempoTotal);

      // Trabajo completado
      trabajo.estado = "completado";
      trabajo.tiempoImpresionMs = tiempoTotal;

      console.log(
        `✅ [LISTO]       ${trabajo.id} | ${trabajo.estudiante} recoge ` +
        `su impresión (${tiempoTotal / 1000}s) ✓`
      );
    }

    console.log("\n🏁 Cola vacía. Todos los documentos fueron impresos.\n");
  }

  /**
   * Muestra visualmente quién está esperando en la cola.
   */
  private mostrarColaActual(): void {
    const enEspera = this.cola.aArreglo();
    if (enEspera.length === 0) {
      console.log("   📭 Cola: vacía (este es el último trabajo)");
      return;
    }
    const nombres = enEspera.map((t, i) => `${i + 1}.${t.estudiante}`).join("  →  ");
    console.log(`   📋 En espera: ${nombres}`);
  }

  /**
   * Retorna las estadísticas de la sesión de impresión.
   */
  obtenerEstadisticas(): EstadisticasSesion {
    const completados = this.historial.filter(t => t.estado === "completado");
    const paginasTotales = this.historial.reduce((acc, t) => acc + t.paginas, 0);
    const tiempos = completados
      .filter(t => t.tiempoImpresionMs !== undefined)
      .map(t => t.tiempoImpresionMs!);
    const tiempoPromedio =
      tiempos.length > 0
        ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
        : 0;

    return {
      totalTrabajos: this.historial.length,
      completados: completados.length,
      paginasTotales,
      tiempoPromedioMs: tiempoPromedio,
      ordenDeAtencion: completados.map(t => t.estudiante),
    };
  }

  /**
   * Muestra el historial completo de trabajos.
   */
  mostrarHistorial(): void {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                  HISTORIAL DE IMPRESIÓN                   ");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(
      " #   | Estudiante       | Documento                | Pág | Tiempo  | Estado"
    );
    console.log("─────────────────────────────────────────────────────────────");

    for (const trabajo of this.historial) {
      const icono =
        trabajo.estado === "completado" ? "✅" :
        trabajo.estado === "imprimiendo" ? "⚙️ " : "⏳";
      const tiempo = trabajo.tiempoImpresionMs
        ? `${trabajo.tiempoImpresionMs / 1000}s`
        : "—";
      console.log(
        ` ${trabajo.id} | ${trabajo.estudiante.padEnd(16)} | ` +
        `${trabajo.documento.padEnd(24)} | ${String(trabajo.paginas).padStart(3)} | ` +
        `${tiempo.padEnd(7)} | ${icono} ${trabajo.estado}`
      );
    }
    console.log("═══════════════════════════════════════════════════════════\n");
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILIDAD
// ─────────────────────────────────────────────────────────────

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
//  SIMULACIÓN — Escenario del salón de clases
// ─────────────────────────────────────────────────────────────

async function simularSalonDeClases(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     COLA DE IMPRESIÓN — Salón de Clases                  ║");
  console.log("║     8 estudiantes · 1 impresora · Día de entrega         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const spooler = new SpoolerImpresion();

  // ── Los 8 estudiantes envían sus documentos casi al mismo tiempo
  console.log("📢 El profesor anuncia: '15 minutos para entregar impreso'\n");
  console.log("── Estudiantes enviando documentos a imprimir... ──────────\n");

  spooler.enviarAImprimir({
    estudiante: "Valentina",
    documento: "Taller_POO.pdf",
    paginas: 3,
    prioridad: "normal",
    horaEnvio: "08:01",
  });

  spooler.enviarAImprimir({
    estudiante: "Camilo",
    documento: "Informe_BD.pdf",
    paginas: 5,
    prioridad: "normal",
    horaEnvio: "08:01",
  });

  spooler.enviarAImprimir({
    estudiante: "Lucía",
    documento: "Diagrama_UML.pdf",
    paginas: 1,
    prioridad: "normal",
    horaEnvio: "08:02",
  });

  spooler.enviarAImprimir({
    estudiante: "Andrés",
    documento: "Proyecto_Final.pdf",
    paginas: 8,
    prioridad: "normal",
    horaEnvio: "08:02",
  });

  spooler.enviarAImprimir({
    estudiante: "Sara",
    documento: "Resumen_Redes.pdf",
    paginas: 2,
    prioridad: "normal",
    horaEnvio: "08:03",
  });

  spooler.enviarAImprimir({
    estudiante: "Miguel",
    documento: "Ejercicios_Algo.pdf",
    paginas: 4,
    prioridad: "normal",
    horaEnvio: "08:03",
  });

  spooler.enviarAImprimir({
    estudiante: "Daniela",
    documento: "Casos_de_Uso.pdf",
    paginas: 6,
    prioridad: "normal",
    horaEnvio: "08:04",
  });

  spooler.enviarAImprimir({
    estudiante: "Felipe",
    documento: "Mapa_Conceptual.pdf",
    paginas: 2,
    prioridad: "normal",
    horaEnvio: "08:04",
  });

  // ── El profesor necesita imprimir con prioridad
  console.log("\n── El profesor interviene con prioridad alta ───────────────\n");

  spooler.enviarAImprimir({
    estudiante: "Profesor García",
    documento: "Lista_Calificaciones.pdf",
    paginas: 1,
    prioridad: "alta",
    horaEnvio: "08:05",
  });

  // ── Procesar toda la cola
  await spooler.procesarCola();

  // ── Mostrar resultados
  spooler.mostrarHistorial();

  const stats = spooler.obtenerEstadisticas();
  console.log("════════════════════ ESTADÍSTICAS DE LA SESIÓN ════════════");
  console.log(`  Total de trabajos enviados : ${stats.totalTrabajos}`);
  console.log(`  Documentos completados     : ${stats.completados}`);
  console.log(`  Total de páginas impresas  : ${stats.paginasTotales}`);
  console.log(`  Tiempo promedio por trabajo: ${stats.tiempoPromedioMs / 1000}s`);
  console.log(`\n  Orden en que recogieron su impresión:`);
  stats.ordenDeAtencion.forEach((nombre, i) => {
    console.log(`    ${i + 1}. ${nombre}`);
  });
  console.log("════════════════════════════════════════════════════════════\n");
}

simularSalonDeClases();