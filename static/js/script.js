document.addEventListener('DOMContentLoaded', () => {

    // --- 1. LÓGICA DE PESTAÑAS (TABS) ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all tabs and navs
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            // Add active class to clicked nav and corresponding tab
            item.classList.add('active');
            const targetTab = item.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');

            // Inicializar y redimensionar el mapa si se activa la pestaña
            if (targetTab === 'tab-mapa-tecnicos') {
                if (typeof inicializarMapaTecnicos === 'function') {
                    inicializarMapaTecnicos();
                }
                if (mapaTecnicos) {
                    setTimeout(() => {
                        mapaTecnicos.invalidateSize();
                    }, 100);
                }
            }
        });
    });

    // --- 1.1 ABRIR PESTAÑA DESDE LA URL (?tab=...) ---
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const tabToActivate = document.querySelector(`.nav-item[data-tab="tab-${tabParam}"]`);
        if (tabToActivate) {
            tabToActivate.click();
        }
    }

    // --- 2. AUTOCOMPLETADO DEL CLIENTE AL PEGAR EL CONTRATO ---
    const inputContrato = document.querySelector('input[name="contrato"]');
    const inputNombre = document.querySelector('input[name="cliente"]');
    const inputTelefonos = document.querySelector('input[name="telefonos"]');
    const selectSector = document.querySelector('select[name="sector"]');
    const inputFecha = document.querySelector('input[name="fecha_programada"]');

    if (inputContrato) {
        // Escucha cuando el asesor sale del campo contrato (presiona Tab o hace clic fuera)
        inputContrato.addEventListener('blur', function () {
            const numeroContrato = this.value.trim();
            const selectEmpresa = document.querySelector('select[name="empresa"]');
            const empresaVal = selectEmpresa ? selectEmpresa.value : '';

            if (numeroContrato !== "") {
                fetch(`/api/cliente/${numeroContrato}?empresa=${encodeURIComponent(empresaVal)}`)
                    .then(response => {
                        if (response.ok) return response.json();
                        throw new Error('Cliente no encontrado en la BD');
                    })
                    .then(data => {
                        // Llenar Nombre
                        if (inputNombre && inputNombre.value === "") {
                            inputNombre.value = data.cliente;
                            // Forzamos el evento 'input' para que la fecha se llene también
                            inputNombre.dispatchEvent(new Event('input'));
                        }

                        // Pre-llenar Teléfonos
                        if (inputTelefonos && inputTelefonos.value === "") {
                            inputTelefonos.value = data.telefonos;
                        }

                        // Seleccionar Sector automáticamente si coincide
                        if (selectSector && data.zona_excel) {
                            const zonaBD = data.zona_excel.trim().toUpperCase();
                            const opciones = Array.from(selectSector.options);
                            const opcionEncontrada = opciones.find(opt => opt.value.toUpperCase() === zonaBD);

                            if (opcionEncontrada) {
                                selectSector.value = opcionEncontrada.value;
                            }
                        }
                    })
                    .catch(error => {
                        console.log("Aviso: ", error.message);
                    });
            }
        });
    }

    // --- 3. AUTO-FECHA AL ESCRIBIR/AUTOCOMPLETAR EL CLIENTE ---
    if (inputNombre && inputFecha) {
        inputNombre.addEventListener('input', function () {
            // Si el cliente tiene texto y la fecha está vacía
            if (this.value.trim() !== "" && inputFecha.value === "") {
                const ahora = new Date();

                // Formato exacto para un campo type="date" (YYYY-MM-DD)
                const anio = ahora.getFullYear();
                const mes = String(ahora.getMonth() + 1).padStart(2, '0');
                const dia = String(ahora.getDate()).padStart(2, '0');

                inputFecha.value = `${anio}-${mes}-${dia}`;
            }
        });
    }

    // --- 4. AUTO-REFRESH INTELIGENTE DE LA PESTAÑA VISITAS (NO DESTRUCTIVO) ---
    let ultimaActividad = Date.now();
    const registrarActividad = () => { ultimaActividad = Date.now(); };
    
    // Registrar actividad del usuario para no interrumpirlo
    document.addEventListener('mousemove', registrarActividad);
    document.addEventListener('keydown', registrarActividad);
    document.addEventListener('click', registrarActividad);
    document.addEventListener('touchstart', registrarActividad);

    setInterval(() => {
        const tabVisitas = document.getElementById('tab-visitas');
        if (tabVisitas && tabVisitas.classList.contains('active')) {
            // 1. Evitar si hubo actividad del usuario en los últimos 15 segundos
            if (Date.now() - ultimaActividad < 15000) return;
            
            // 2. Evitar si hay algún input, textarea o select con el foco activo (escribiendo/seleccionando)
            const elementoActivo = document.activeElement;
            if (elementoActivo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(elementoActivo.tagName)) return;
            
            // 3. Evitar si el buscador de clientes tiene algún texto escrito
            const buscadorCliente = document.querySelector('input[name="buscar_cliente"]');
            if (buscadorCliente && buscadorCliente.value.trim() !== "") return;
            
            // 4. Evitar si el usuario tiene abierta la sección de detalles de alguna visita
            const detallesAbiertos = document.querySelectorAll('tr[id^="detalles-"]:not([style*="display: none"])');
            if (detallesAbiertos.length > 0) return;
            
            // 5. Evitar si el modal de historial de visitas está abierto en pantalla
            const modalHistorial = document.getElementById('modalHistorial');
            if (modalHistorial && modalHistorial.style.display === 'flex') return;

            // Si es seguro, recarga para actualizar cronómetros y estados de visitas
            location.reload();
        }
    }, 30000); // Revisar cada 30 segundos

});

// --- 4. OPTIMIZADOR DE RUTAS (Actualizado) ---
// --- 4. OPTIMIZADOR DE RUTAS (Actualizado con Despacho Diario) ---
function ejecutarOptimizacion() {
    const contenedorResultados = document.getElementById('resultados_optimizacion');
    const btn = document.getElementById('btn_optimizar');

    // 1. Recopilar técnicos seleccionados y sus horas
    const tecnicosSaldran = [];
    const filas = document.querySelectorAll('#lista-despacho tr');

    filas.forEach((fila, index) => {
        const checkbox = fila.querySelector('.tec-checkbox');
        // Si el técnico está marcado para trabajar hoy...
        if (checkbox && checkbox.checked) {
            const nombre = checkbox.value;
            const timeInput = fila.querySelector('input[type="time"]').value;

            // Convertimos la hora "08:30" a minutos totales desde la medianoche (510)
            const partesHora = timeInput.split(':');
            const minutosDesdeMedianoche = parseInt(partesHora[0]) * 60 + parseInt(partesHora[1]);

            tecnicosSaldran.push({
                nombre: nombre,
                hora_inicio_min: minutosDesdeMedianoche
            });
        }
    });

    if (tecnicosSaldran.length === 0) {
        alert("Debes seleccionar al menos un técnico para generar rutas.");
        return;
    }

    // 2. Deshabilitar botón y mostrar carga
    btn.disabled = true;
    btn.innerText = "Calculando rutas óptimas...";
    contenedorResultados.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>El motor OR-Tools está procesando a ${tecnicosSaldran.length} técnicos...</p>
        </div>
    `;

    // 3. Enviar al backend (Python)
    fetch('/api/optimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tecnicos_activos: tecnicosSaldran })
    })
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.innerText = "⚙️ Ejecutar Motor de Optimización";

            if (data.status === 'success') {
                dibujarRutas(data.rutas);
            } else {
                contenedorResultados.innerHTML = `<div class="error-msg" style="color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;"><strong>Aviso:</strong> ${data.mensaje}</div>`;
            }
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerText = "⚙️ Ejecutar Motor de Optimización";
            contenedorResultados.innerHTML = `<div class="error-msg" style="color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;">Error de conexión con el servidor.</div>`;
        });
}

function dibujarRutas(rutas) {
    const contenedor = document.getElementById('resultados_optimizacion');
    let html = '';

    rutas.forEach(rutaObj => {
        html += `<div class="card" style="margin-bottom: 20px; border-left: 5px solid #ef4444;">`;
        html += `<h3 style="color: #b91c1c; margin-top: 0; margin-bottom: 15px;">⚡ Ruta de: ${rutaObj.nombre_real}</h3>`;

        rutaObj.ruta.forEach((paso, index) => {
            if (paso.nodo === 0) {
                // Punto de partida
                html += `<div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <strong style="color: #475569; font-size: 1.1rem; width: 60px; display: inline-block;">${paso.hora_texto}</strong> 
                            <span style="color: #64748b;">${paso.cliente}</span>
                         </div>`;
            } else {
                // Visitas
                let badge = '';
                if (paso.prioridad === 'ALTA') badge = '<span style="background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 10px;">🔴 ALTA</span>';
                else if (paso.prioridad === 'BAJA') badge = '<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 10px;">⚪ BAJA</span>';
                else badge = '<span style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 10px;">🟡 MEDIA</span>';

                html += `<div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                <strong style="color: #2563eb; font-size: 1.1rem; width: 60px; display: inline-block;">${paso.hora_texto}</strong>
                                ${badge}
                                <strong style="font-size: 1.05rem;">#${paso.nodo} - ${paso.cliente}</strong>
                            </div>
                            <div style="margin-left: 60px; font-size: 0.85rem; color: #64748b;">
                                <span>📍 Sector: <strong>${paso.sector}</strong></span> | 
                                <span>⏰ Pidió: <strong>${paso.preferencia}</strong></span>
                            </div>
                         </div>`;
            }
        });

        html += `</div>`;
    });

    contenedor.innerHTML = html;
}