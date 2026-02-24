# Estructura de Datos: Cola de Impresión en el Salón de Clases

Este proyecto implementa una simulación de una cola de impresión compartida en un aula universitaria utilizando TypeScript.

## Descripción

El sistema gestiona los trabajos de impresión de 8 estudiantes que comparten una sola impresora, utilizando una estructura de datos **Cola (Queue)** basada en una lista enlazada (Linked List) para garantizar una complejidad O(1) en las operaciones de encolar (`encolar`) y desencolar (`desencolar`).

### Características

- **Patrón FIFO:** Los documentos se imprimen en orden de llegada. El primer estudiante que envía su documento es el primero en recoger su impresión.
- **Prioridad:** El profesor puede insertar su trabajo al frente de la cola sin interrumpir el documento que se está imprimiendo en ese momento.
- **Simulación asíncrona:** Simula el tiempo de impresión según la cantidad de páginas de cada documento (500ms por página).
- **Métricas:** Genera estadísticas de trabajos completados, páginas totales impresas, tiempo promedio y orden de atención.

## Tecnologías

- TypeScript
- Node.js (para ejecución)

## Ejecución

Para ejecutar la simulación:

```bash
npx ts-node cola-impresion.ts
```

## Autor

Andrés Urbano