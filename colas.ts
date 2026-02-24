/**
 * ============================================================
 *  CASE STUDY: Classroom Print Queue
 * ============================================================
 *
 *  CONTEXT:
 *  8 students share a single printer in the classroom.
 *  They all send their documents to print almost simultaneously.
 *  The system serves them in order of arrival (FIFO).
 *  The teacher can insert their job with high priority.
 *
 *  OOP CONCEPTS APPLIED:
 *  - Encapsulation : private attributes in Node, Queue and PrintQueue
 *  - Abstraction   : the user only calls enqueue() and processQueue()
 *  - Composition   : PrintQueue contains a Queue<PrintJob>
 *  - Generics      : Queue<T> reusable with any type
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

/** Priority level of the job */
type Priority = "high" | "normal";

/** Status of the job in the spooler */
type JobStatus = "waiting" | "printing" | "completed";

/** Represents a document sent to print */
interface PrintJob {
  id: string;                 // Unique job identifier
  student: string;            // Student name
  document: string;           // File name
  pages: number;              // Number of pages
  priority: Priority;         // Normal or high (teacher)
  sentAt: string;             // Time the job was sent
  status: JobStatus;          // Current status
  printTimeMs?: number;       // How long it took to print (once completed)
}

/** Parameters to create a new job */
type NewJob = Omit<PrintJob, "id" | "status" | "printTimeMs">;

/** Statistics for the print session */
interface SessionStats {
  totalJobs: number;
  completed: number;
  totalPages: number;
  averageTimeMs: number;
  attendanceOrder: string[];
}

// ─────────────────────────────────────────────────────────────
//  NODE — Basic unit of the linked list
// ─────────────────────────────────────────────────────────────

class Node<T> {
  value: T;
  next: Node<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

// ─────────────────────────────────────────────────────────────
//  GENERIC QUEUE (FIFO) with priority support
//  - enqueue()      O(1) — adds to the end
//  - enqueueFront() O(1) — adds to the front (high priority)
//  - dequeue()      O(1) — removes from the front
//  - peek()         O(1) — reads front without removing
// ─────────────────────────────────────────────────────────────

class Queue<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private _size: number = 0;

  /** Adds an element to the END — normal FIFO order */
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

  /**
   * Adds an element to the FRONT — for high priority jobs.
   * The job is inserted right after the one currently printing
   * (the current job cannot be interrupted).
   */
  enqueueFront(value: T): void {
    const node = new Node(value);
    node.next = this.head;
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
    this._size++;
  }

  /** Removes and returns the FRONT element — O(1) */
  dequeue(): T | undefined {
    if (!this.head) return undefined;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this._size--;
    return value;
  }

  /** Reads the front element without removing it — O(1) */
  peek(): T | undefined {
    return this.head?.value;
  }

  get size(): number {
    return this._size;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  /** Converts the queue to an array for display */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }
}

// ─────────────────────────────────────────────────────────────
//  PRINT SPOOLER — Main case study
// ─────────────────────────────────────────────────────────────

class PrintSpooler {
  /** Internal queue of pending jobs */
  private queue: Queue<PrintJob> = new Queue();

  /** Full history of all processed jobs */
  private history: PrintJob[] = [];

  /** Counter to generate unique IDs */
  private jobCounter: number = 0;

  /** Printing speed: ms per page */
  private readonly MS_PER_PAGE = 500;

  /**
   * Receives a new print job.
   * If it has HIGH priority (e.g. the teacher), it is inserted
   * at the front of the queue without interrupting the current job.
   * If it has NORMAL priority, it goes to the end of the queue.
   */
  sendToPrint(data: NewJob): PrintJob {
    const job: PrintJob = {
      ...data,
      id: `DOC-${String(++this.jobCounter).padStart(3, "0")}`,
      status: "waiting",
    };

    if (job.priority === "high") {
      this.queue.enqueueFront(job);
      console.log(
        `🔴 [PRIORITY] ${job.student} → "${job.document}" ` +
        `(${job.pages} pg.) inserted at the FRONT of the queue`
      );
    } else {
      this.queue.enqueue(job);
      console.log(
        `📄 [RECEIVED] ${job.student} → "${job.document}" ` +
        `(${job.pages} pg.) added to the queue | position: ${this.queue.size}`
      );
    }

    this.history.push(job);
    return job;
  }

  /**
   * Processes all jobs in the queue one by one.
   * Simulates print time based on the number of pages.
   */
  async processQueue(): Promise<void> {
    console.log("\n🖨️  ══════════════════════════════════════════════");
    console.log("    PRINTER READY — Starting to process queue");
    console.log("    ══════════════════════════════════════════════\n");

    while (!this.queue.isEmpty) {
      const job = this.queue.dequeue()!;

      // Show who is next in line
      this.showCurrentQueue();

      // Change status to printing
      job.status = "printing";
      console.log(
        `\n⚙️  [PRINTING] ${job.id} | ${job.student} | ` +
        `"${job.document}" | ${job.pages} page(s)...`
      );

      // Simulate print time (500ms per page)
      const totalTime = job.pages * this.MS_PER_PAGE;
      await wait(totalTime);

      // Job completed
      job.status = "completed";
      job.printTimeMs = totalTime;

      console.log(
        `✅ [DONE]      ${job.id} | ${job.student} picks up ` +
        `their printout (${totalTime / 1000}s) ✓`
      );
    }

    console.log("\n🏁 Queue empty. All documents have been printed.\n");
  }

  /**
   * Displays who is currently waiting in the queue.
   */
  private showCurrentQueue(): void {
    const waiting = this.queue.toArray();
    if (waiting.length === 0) {
      console.log("   📭 Queue: empty (this is the last job)");
      return;
    }
    const names = waiting.map((j, i) => `${i + 1}.${j.student}`).join("  →  ");
    console.log(`   📋 Waiting: ${names}`);
  }

  /**
   * Returns the statistics for the print session.
   */
  getStats(): SessionStats {
    const completed = this.history.filter(j => j.status === "completed");
    const totalPages = this.history.reduce((acc, j) => acc + j.pages, 0);
    const times = completed
      .filter(j => j.printTimeMs !== undefined)
      .map(j => j.printTimeMs!);
    const averageTime =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;

    return {
      totalJobs: this.history.length,
      completed: completed.length,
      totalPages,
      averageTimeMs: averageTime,
      attendanceOrder: completed.map(j => j.student),
    };
  }

  /**
   * Displays the full job history.
   */
  printHistory(): void {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                    PRINT JOB HISTORY                      ");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(
      " #   | Student          | Document                 | Pg  | Time    | Status"
    );
    console.log("─────────────────────────────────────────────────────────────");

    for (const job of this.history) {
      const icon =
        job.status === "completed" ? "✅" :
        job.status === "printing"  ? "⚙️ " : "⏳";
      const time = job.printTimeMs
        ? `${job.printTimeMs / 1000}s`
        : "—";
      console.log(
        ` ${job.id} | ${job.student.padEnd(16)} | ` +
        `${job.document.padEnd(24)} | ${String(job.pages).padStart(3)} | ` +
        `${time.padEnd(7)} | ${icon} ${job.status}`
      );
    }
    console.log("═══════════════════════════════════════════════════════════\n");
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
//  SIMULATION — Classroom scenario
// ─────────────────────────────────────────────────────────────

async function simulateClassroom(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     PRINT QUEUE — Classroom                              ║");
  console.log("║     8 students · 1 printer · Submission day              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const spooler = new PrintSpooler();

  // ── The 8 students send their documents almost simultaneously
  console.log("📢 Teacher announces: '15 minutes to submit printed copy'\n");
  console.log("── Students sending documents to print... ─────────────────\n");

  spooler.sendToPrint({
    student: "Valentina",
    document: "OOP_Workshop.pdf",
    pages: 3,
    priority: "normal",
    sentAt: "08:01",
  });

  spooler.sendToPrint({
    student: "Camilo",
    document: "DB_Report.pdf",
    pages: 5,
    priority: "normal",
    sentAt: "08:01",
  });

  spooler.sendToPrint({
    student: "Lucía",
    document: "UML_Diagram.pdf",
    pages: 1,
    priority: "normal",
    sentAt: "08:02",
  });

  spooler.sendToPrint({
    student: "Andrés",
    document: "Final_Project.pdf",
    pages: 8,
    priority: "normal",
    sentAt: "08:02",
  });

  spooler.sendToPrint({
    student: "Sara",
    document: "Networks_Summary.pdf",
    pages: 2,
    priority: "normal",
    sentAt: "08:03",
  });

  spooler.sendToPrint({
    student: "Miguel",
    document: "Algorithms_Exercises.pdf",
    pages: 4,
    priority: "normal",
    sentAt: "08:03",
  });

  spooler.sendToPrint({
    student: "Daniela",
    document: "Use_Cases.pdf",
    pages: 6,
    priority: "normal",
    sentAt: "08:04",
  });

  spooler.sendToPrint({
    student: "Felipe",
    document: "Concept_Map.pdf",
    pages: 2,
    priority: "normal",
    sentAt: "08:04",
  });

  // ── The teacher needs to print with high priority
  console.log("\n── Teacher intervenes with high priority ───────────────────\n");

  spooler.sendToPrint({
    student: "Teacher García",
    document: "Grades_List.pdf",
    pages: 1,
    priority: "high",
    sentAt: "08:05",
  });

  // ── Process the entire queue
  await spooler.processQueue();

  // ── Show results
  spooler.printHistory();

  const stats = spooler.getStats();
  console.log("════════════════════ SESSION STATISTICS ═══════════════════");
  console.log(`  Total jobs sent         : ${stats.totalJobs}`);
  console.log(`  Completed documents     : ${stats.completed}`);
  console.log(`  Total pages printed     : ${stats.totalPages}`);
  console.log(`  Average time per job    : ${stats.averageTimeMs / 1000}s`);
  console.log(`\n  Order in which students picked up their printout:`);
  stats.attendanceOrder.forEach((name, i) => {
    console.log(`    ${i + 1}. ${name}`);
  });
  console.log("════════════════════════════════════════════════════════════\n");
}

simulateClassroom();