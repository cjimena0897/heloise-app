# Conectar la app a Firebase (datos compartidos)

Con Firebase, todas las personas del equipo ven el mismo inventario, las mismas ventas y las
mismas deudas en tiempo real. Si se va el internet (por ejemplo en un evento), la app sigue
funcionando y sube los cambios sola cuando vuelve la conexión.

Es gratis para el volumen de AJVC (plan *Spark*). No pide tarjeta.

## 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto**. Nombre: `ajvc-inventario`.
3. Google Analytics: **desactívalo** (no hace falta) → **Crear proyecto**.

## 2. Activar el inicio de sesión

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. En *Proveedores de acceso* elige **Correo electrónico/contraseña** → actívalo → **Guardar**
   (deja desactivado "vínculo de correo electrónico").
3. Pestaña **Usuarios** → **Agregar usuario**: crea una cuenta para cada persona
   (su correo y una contraseña temporal). Cada una puede cambiarla luego con
   "Olvidé mi contraseña" en la app.
4. (Recomendado) Pestaña **Configuración → Acciones del usuario** → desmarca
   **Habilitar la creación (registro)** → **Guardar**. Así nadie más puede crearse una cuenta.

## 3. Crear la base de datos

1. Menú izquierdo → **Compilación → Firestore Database** → **Crear base de datos**.
2. Edición **Standard**. Ubicación: **southamerica-east1 (São Paulo)**, la más cercana a Perú.
   *(No se puede cambiar después.)*
3. Elige **Iniciar en modo de producción** → **Crear**.
4. Pestaña **Reglas**: borra todo y pega el contenido de [`firestore.rules`](firestore.rules),
   reemplazando `persona1@gmail.com`, etc. por los correos reales (en minúsculas).
   → **Publicar**.

> Para agregar o quitar a alguien más adelante: crea/borra su usuario en *Authentication* y
> edita la lista de correos en *Reglas*.

## 4. Copiar la configuración

1. Arriba a la izquierda, ⚙ → **Configuración del proyecto**.
2. En **Tus apps** toca el ícono web **`</>`**. Apodo: `AJVC`. **No** marques Firebase Hosting.
   → **Registrar app**.
3. Aparece un bloque `const firebaseConfig = { apiKey: "...", ... }`. Cópialo y pégalo en
   [`src/firebaseConfig.js`](src/firebaseConfig.js) (o envíaselo a quien mantiene la app).
   Estos datos no son secretos: lo que protege la información es el inicio de sesión y las reglas.

## 5. Primer uso

1. Publica la app en Vercel con la configuración ya puesta.
2. Entra **primero desde el celular que ya tiene los productos y ventas guardados**.
   Toca el indicador verde de arriba a la derecha → **Subir a la nube**.
3. Luego las demás personas abren el enlace, ingresan con su correo y la instalan:
   - **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio*.
   - **Android (Chrome):** menú ⋮ → *Instalar app*.

## Bueno saber

- El **carrito** (venta en curso) es de cada celular; al confirmar, la venta se comparte.
- Cada venta y pago guarda **quién lo registró**.
- Indicador arriba a la derecha: 🟢 en línea · 🟡 subiendo cambios · 🔴 sin conexión.
- Sin internet se puede vender igual. Si dos personas venden la **última unidad** al mismo
  tiempo estando ambas sin conexión, el stock puede quedar en −1; se corrige con una entrada.
