/**
 * ============================================================
 *  CASO DE ESTUDIO: Cola de Renderizado de Previsualizaciones
 *  en un Editor de Video Online (estilo CapCut / Canva Video)
 * ============================================================
 *
 *  CONTEXTO REAL:
 *  Cuando editas un video en el navegador y aplicas un filtro,
 *  recortas un clip o ajustas el brillo, la plataforma no
 *  re-renderiza todos los segmentos al mismo tiempo: los encola
 *  y los procesa uno a uno (o con concurrencia limitada) para
 *  no saturar el hilo principal ni la GPU virtual del browser.
 *
 *  Este sistema simula exactamente esa cola de trabajos de
 *  renderizado usando el patrón FIFO con soporte para:
 *    - Prioridad de segmentos (el segmento visible primero)
 *    - Cancelación de trabajos obsoletos (el usuario cambió el
 *      filtro antes de que terminara el render anterior)
 *    - Métricas en tiempo real (trabajos pendientes, procesados,
 *      tiempo promedio de render)
 *
 *  
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────────────────────

/** Tipos de operación que puede tener un segmento de video */
type EffectType =
  | "color_grade"   // Corrección de color
  | "blur"          // Desenfoque
  | "trim"          // Recorte de duración
  | "speed_change"  // Cambio de velocidad
  | "transition";   // Transición entre clips

/** Prioridad del trabajo: el segmento en pantalla va primero */
type Priority = "high" | "normal" | "low";

/** Estado del trabajo en la cola */
type JobStatus = "pending" | "processing" | "done" | "cancelled";

/** Representa un trabajo de renderizado de un segmento de video */
interface RenderJob {
  id: string;               // Identificador único
  segmentId: string;        // ID del segmento en el timeline
  effect: EffectType;       // Qué operación hay que aplicar
  priority: Priority;       // Urgencia del render
  createdAt: number;        // Timestamp de creación (ms)
  status: JobStatus;        // Estado actual
  durationMs?: number;      // Cuánto tardó en procesarse (una vez terminado)
}

/** Parámetros para crear un nuevo trabajo */
type CreateJobParams = Pick<RenderJob, "segmentId" | "effect" | "priority">;

/** Estadísticas de la cola */
interface QueueStats {
  pending: number;
  processing: number;
  done: number;
  cancelled: number;
  averageRenderTimeMs: number;
}

// ─────────────────────────────────────────────────────────────
//  NODO DE LA LISTA ENLAZADA (estructura interna de la cola)
//  → Los nodos permiten O(1) en enqueue y dequeue sin usar
//    array.shift(), que es O(n).
// ─────────────────────────────────────────────────────────────

class Node<T> {
  value: T;
  next: Node<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}



class Queue<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private _size: number = 0;

  /** Agrega un elemento al final de la cola — O(1) */
  enqueue(value: T): void {
    const node = new Node(value);
    if (this.tail) {
      this.tail.next = node;
    }
    this.tail = node;
    if (!this.head) {
      this.head = node;
    }
    this._size++;
  }

  /** Elimina y retorna el elemento del frente — O(1) */
  dequeue(): T | undefined {
    if (!this.head) return undefined;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this._size--;
    return value;
  }

  /** Consulta el frente sin eliminar — O(1) */
  peek(): T | undefined {
    return this.head?.value;
  }

  get size(): number {
    return this._size;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** Itera sobre todos los elementos sin modificar la cola */
  [Symbol.iterator](): Iterator<T> {
    let current = this.head;
    return {
      next(): IteratorResult<T> {
        if (current) {
          const value = current.value;
          current = current.next;
          return { value, done: false };
        }
        return { value: undefined as unknown as T, done: true };
      },
    };
  }

  /** Convierte la cola a array para inspección */
  toArray(): T[] {
    return [...this];
  }
}


class VideoRenderQueue {
  /** Cola interna de trabajos pendientes (FIFO) */
  private queue: Queue<RenderJob> = new Queue();

  /** Historial completo para estadísticas */
  private history: RenderJob[] = [];

  /** Mapa de trabajos cancelados (por segmentId) para lookup rápido */
  private cancelledSegments: Set<string> = new Set();

  /** ¿Hay un worker procesando actualmente? */
  private isProcessing: boolean = false;

  /** Contador para generar IDs únicos */
  private jobCounter: number = 0;

  /**
   * Encola un nuevo trabajo de renderizado.
   *
   * Si el segmento ya tenía un trabajo pendiente (por ejemplo,
   * el usuario cambió el filtro dos veces rápido), el trabajo
   * anterior se marca como CANCELADO y sólo se procesa el nuevo.
   * Esto evita renders innecesarios, como hace CapCut internamente.
   */
  enqueue(params: CreateJobParams): RenderJob {
    // Cancelar trabajos previos del mismo segmento (aún pendientes)
    this.cancelPendingForSegment(params.segmentId);

    const job: RenderJob = {
      id: `job_${++this.jobCounter}`,
      segmentId: params.segmentId,
      effect: params.effect,
      priority: params.priority,
      createdAt: Date.now(),
      status: "pending",
    };

    this.queue.enqueue(job);
    this.history.push(job);

    console.log(
      `[ENQUEUE] ${job.id} | segmento: ${job.segmentId} | efecto: ${job.effect} | prioridad: ${job.priority}`
    );

    // Iniciar procesamiento si no hay uno activo
    if (!this.isProcessing) {
      this.processNext();
    }

    return job;
  }

  /**
   * Cancela todos los trabajos pendientes de un segmento específico.
   * Se usa cuando el usuario modifica un segmento antes de que
   * terminara su render previo.
   */
  cancelPendingForSegment(segmentId: string): void {
    this.cancelledSegments.add(segmentId);

    // Marcar en el historial los trabajos pendientes de ese segmento
    for (const job of this.history) {
      if (job.segmentId === segmentId && job.status === "pending") {
        job.status = "cancelled";
        console.log(
          `[CANCEL]  ${job.id} cancelado (nuevo cambio en segmento ${segmentId})`
        );
      }
    }
  }

  /**
   * Procesador interno: toma el siguiente trabajo de la cola,
   * lo ejecuta y llama recursivamente al siguiente.
   *
   * Simula el worker de renderizado con una espera asíncrona
   * proporcional al tipo de efecto.
   */
  private async processNext(): Promise<void> {
    if (this.queue.isEmpty) {
      this.isProcessing = false;
      console.log(`[QUEUE]   Cola vacía. Worker en reposo.\n`);
      return;
    }

    this.isProcessing = true;
    const job = this.queue.dequeue()!;

    // Si el trabajo fue cancelado mientras esperaba, saltar al siguiente
    if (job.status === "cancelled") {
      console.log(`[SKIP]    ${job.id} omitido (cancelado previamente)`);
      return this.processNext();
    }

    job.status = "processing";
    console.log(`[START]   ${job.id} → aplicando "${job.effect}" en ${job.segmentId}...`);

    const startTime = Date.now();

    // Simular tiempo de render según el tipo de efecto
    const renderTime = this.estimateRenderTime(job.effect);
    await sleep(renderTime);

    job.status = "done";
    job.durationMs = Date.now() - startTime;

    console.log(
      `[DONE]    ${job.id} completado en ${job.durationMs}ms ✓`
    );

    // Procesar el siguiente trabajo
    this.processNext();
  }

  /**
   * Estima el tiempo de render simulado según el tipo de efecto.
   * En una implementación real, esto dependería de la GPU y
   * la duración del segmento.
   */
  private estimateRenderTime(effect: EffectType): number {
    const times: Record<EffectType, number> = {
      trim: 100,           // Rápido: solo reindexar frames
      speed_change: 200,   // Medio: interpolar frames
      color_grade: 350,    // Lento: procesar píxeles
      blur: 300,           // Lento: convolución
      transition: 250,     // Medio: combinar dos clips
    };
    return times[effect];
  }

  /**
   * Devuelve estadísticas actuales de la cola.
   */
  getStats(): QueueStats {
    const counts = { pending: 0, processing: 0, done: 0, cancelled: 0 };
    const renderTimes: number[] = [];

    for (const job of this.history) {
      counts[job.status]++;
      if (job.status === "done" && job.durationMs !== undefined) {
        renderTimes.push(job.durationMs);
      }
    }

    const averageRenderTimeMs =
      renderTimes.length > 0
        ? Math.round(renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length)
        : 0;

    return {
      ...counts,
      averageRenderTimeMs,
    };
  }

  /**
   * Muestra el estado de todos los trabajos en el historial.
   */
  printHistory(): void {
    console.log("\n═══════════════ HISTORIAL DE TRABAJOS ═══════════════");
    for (const job of this.history) {
      const duration = job.durationMs ? `${job.durationMs}ms` : "—";
      const statusIcon =
        job.status === "done" ? "✓" :
        job.status === "cancelled" ? "✗" :
        job.status === "processing" ? "⟳" : "…";
      console.log(
        `  ${statusIcon} ${job.id.padEnd(8)} | ${job.segmentId.padEnd(10)} | ${job.effect.padEnd(14)} | ${job.status.padEnd(10)} | ${duration}`
      );
    }
    console.log("═════════════════════════════════════════════════════\n");
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILIDAD
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
//  SIMULACIÓN — Escenario realista de uso
// ─────────────────────────────────────────────────────────────

async function runSimulation(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  SIMULADOR DE COLA DE RENDERIZADO — Editor de Video ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  const renderQueue = new VideoRenderQueue();

  // ── Acción 1: El usuario aplica efectos a 3 segmentos distintos
  console.log("► El usuario aplica color_grade al segmento de apertura (visible → high)");
  renderQueue.enqueue({ segmentId: "seg_001", effect: "color_grade", priority: "high" });

  console.log("► El usuario aplica blur al segmento de fondo (no visible → normal)");
  renderQueue.enqueue({ segmentId: "seg_002", effect: "blur", priority: "normal" });

  console.log("► El usuario añade una transición entre clips");
  renderQueue.enqueue({ segmentId: "seg_003", effect: "transition", priority: "normal" });

  // ── Acción 2: Antes de que termine seg_002, el usuario cambia el efecto
  await sleep(150); // Después de que empiece el render de seg_001

  console.log("\n► El usuario cambia de idea: quiere speed_change en seg_002 (sobrescribe blur)");
  renderQueue.enqueue({ segmentId: "seg_002", effect: "speed_change", priority: "normal" });

  // ── Acción 3: Agrega un recorte de baja prioridad
  console.log("► El usuario recorta seg_004 (no visible → low)");
  renderQueue.enqueue({ segmentId: "seg_004", effect: "trim", priority: "low" });

  // ── Esperar a que todos los renders terminen
  await sleep(2000);

  // ── Mostrar resultados
  renderQueue.printHistory();

  const stats = renderQueue.getStats();
  console.log("════════════════════ ESTADÍSTICAS ════════════════════");
  console.log(`  Trabajos pendientes:    ${stats.pending}`);
  console.log(`  En procesamiento:       ${stats.processing}`);
  console.log(`  Completados:            ${stats.done}`);
  console.log(`  Cancelados:             ${stats.cancelled}`);
  console.log(`  Tiempo promedio render: ${stats.averageRenderTimeMs}ms`);
  console.log("═══════════════════════════════════════════════════════\n");
}

runSimulation();