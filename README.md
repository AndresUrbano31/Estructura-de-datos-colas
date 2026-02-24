# Estructura de Datos: Cola de Renderizado de Video

Este proyecto implementa una simulación de una cola de renderizado de video (estilo CapCut o Canva Video) utilizando TypeScript.

## Descripción

El sistema gestiona trabajos de renderizado de segmentos de video utilizando una estructura de datos **Cola (Queue)** basada en una lista enlazada (Linked List) para garantizar una complejidad O(1) en las operaciones de encolar (`enqueue`) y desencolar (`dequeue`).

### Características

- **Patrón FIFO:** Los trabajos se procesan en orden de llegada.
- **Cancelación de trabajos:** Si un segmento se modifica antes de ser procesado, el trabajo anterior se cancela para optimizar recursos.
- **Simulación asíncrona:** Simula tiempos de renderizado variables según el efecto aplicado (color grade, blur, etc.).
- **Métricas:** Genera estadísticas de trabajos pendientes, procesados, cancelados y tiempo promedio.

## Tecnologías

- TypeScript
- Node.js (para ejecución)

## Ejecución

Para ejecutar la simulación:

```bash
npx ts-node colas.ts
```

## Autor

Andrés Urbano