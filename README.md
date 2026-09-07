# Kawvo Link / INTAP Link

Plataforma de perfiles digitales y presentaciones interactivas.

## Método de trabajo aprobado con el asistente

Este repositorio usa como regla operativa el siguiente flujo de trabajo cuando el asistente dispone de acceso de escritura al repositorio:

1. **El asistente investiga y ejecuta los cambios en el repositorio.**
   - revisa rama, HEAD, archivos y contexto;
   - modifica el código directamente en GitHub/repositorio;
   - crea commits trazables;
   - no delega al usuario ediciones de código que pueda realizar por sí mismo.

2. **El usuario no debe editar código por comandos salvo excepción justificada.**
   Los comandos que se entregan al usuario se reservan para acciones que dependen de su entorno local o de sus credenciales, principalmente:
   - sincronizar su copia local con la rama remota;
   - build o deploy que requiera su Mac/Cloudflare/Wrangler autenticado;
   - QA local o físico que solo el usuario pueda realizar.

3. **Cuando el usuario deba ejecutar algo, se entrega un único bloque listo para copiar y pegar.**
   No se fragmentan instrucciones innecesariamente ni se le piden verificaciones Git rutinarias que el asistente pueda resolver desde el repositorio.

4. **Preview primero.**
   - cambios de UI o funcionalidad se validan primero en Preview;
   - Producción no se toca sin autorización explícita del usuario;
   - un HTTP 200 no sustituye QA visual/funcional.

5. **Trabajo por lotes pequeños.**
   - un objetivo concreto por lote;
   - no mezclar UI, D1, Worker, OAuth, migraciones o Producción si el lote no lo requiere;
   - preservar todo lo ya aprobado fuera del alcance del lote.

6. **El asistente debe evitar runners sobredimensionados.**
   Si el cambio es solo visual, el runner de Preview no debe tocar D1 ni Worker. Cada runner debe ejecutar únicamente las capas necesarias para el lote.

7. **Después del QA del usuario:**
   - si aprueba, se consolida el lote y se continúa;
   - si detecta un problema, se corrige sobre el mismo lote antes de abrir otro frente.

8. **Excepción:**
   Si el asistente no dispone temporalmente de permisos o herramientas para modificar el repositorio, debe indicarlo explícitamente antes de pedir al usuario que ejecute cambios manuales.

### Regla corta

> **Asistente = analiza, modifica, versiona y prepara. Usuario = sincroniza local, despliega cuando sus credenciales sean necesarias y hace QA/aprobación.**

Esta regla debe tratarse como parte del contrato operativo del proyecto y no como una preferencia ocasional de una conversación.
