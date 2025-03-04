document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('creditoForm');
    const tableBody = document.querySelector('#creditosTable tbody');
    const ctx = document.getElementById('creditosChart').getContext('2d');
    let creditosChart = null;

    // Función para cargar créditos desde la API y actualizar la tabla
    function cargarCreditos() {
        fetch('/api/creditos')
            .then(response => response.json())
            .then(data => {
                tableBody.innerHTML = '';
                data.forEach((credito, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                      <td>${index + 1}</td> <!-- Me ayuda a reordenar IDs si los eh eliminado -->
                      <td>${credito.cliente}</td>
                      <td>${credito.monto}</td>
                      <td>${credito.tasa_interes}</td>
                      <td>${credito.plazo}</td>
                      <td>${credito.fecha_otorgamiento}</td>
                      <td>
                        <button class="btn btn-sm btn-warning me-2" 
                            onclick="editarCredito(${credito.id})">
                        <i class="fas fa-edit"> </i>
                        </button>
                        <button class="btn btn-sm btn-danger" 
                            onclick="eliminarCredito(${credito.id})">
                        <i class="fas fa-trash"> </i>
                        </button>
        </td>
                    `;
                    tableBody.appendChild(tr);
                });
                // Actualizar gráfica con el tipo seleccionado ya sea en general o por cliente
                actualizarGrafica(document.getElementById('tipoGrafica').value);
            });
    }

    // Función para actualizar la gráfica
    async function actualizarGrafica(tipo = 'total') {
        let url, config;
        
        switch(tipo) {
            case 'cliente':
                url = '/api/creditos/distribucion/cliente';
                config = await getChartConfig(url, 'bar', 'Monto por Cliente', 'cliente', 'total');
                break;
            
            case 'monto':
                url = '/api/creditos/distribucion/montos';
                config = await getChartConfig(url, 'pie', 'Distribución por Monto', 'rango', 'total');
                break;
            
            default: // Total
                url = '/api/creditos';
                config = await getTotalConfig(url);
                break;
        }

        if (creditosChart) creditosChart.destroy();
        creditosChart = new Chart(ctx, config);
    }

    async function getChartConfig(url, chartType, label, labelKey, dataKey) {
        const response = await fetch(url);
        const data = await response.json();

        return {
            type: chartType,
            data: {
                labels: data.map(item => item[labelKey]),
                datasets: [{
                    label: label,
                    data: data.map(item => item[dataKey]),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#EB5757', '#00CC99'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: {
                        display: true,
                        text: label,
                        font: { size: 16 }
                    }
                },
                scales: chartType === 'bar' ? { y: { beginAtZero: true } } : undefined
            }
        };
    }

    async function getTotalConfig(url) {
        const response = await fetch(url);
        const data = await response.json();
        const total = data.reduce((sum, credito) => sum + credito.monto, 0);

        return {
            type: 'bar',
            data: {
                labels: ['Total de Créditos'],
                datasets: [{
                    label: 'Monto Total',
                    data: [total],
                    backgroundColor: '#36A2EB',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monto Total Otorgado',
                        font: { size: 16 }
                    }
                },
                scales: { y: { beginAtZero: true } }
            }
        };
    }

    //  cambiar el tipo de gráfica
    document.getElementById('tipoGrafica').addEventListener('change', (e) => {
        actualizarGrafica(e.target.value);
    });

    // Registrar nuevo crédito
    document.getElementById('creditoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const credito = {
            cliente: document.getElementById('cliente').value,
            monto: parseFloat(document.getElementById('monto').value),
            tasa_interes: parseFloat(document.getElementById('tasa_interes').value),
            plazo: parseInt(document.getElementById('plazo').value),
            fecha_otorgamiento: document.getElementById('fecha_otorgamiento').value
        };

        fetch('/api/creditos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credito)
        })
        .then(response => {
            if (!response.ok) throw new Error('Error en el servidor');
            return response.json();
        })
        .then(data => {
            alert(`Crédito registrado! ID: ${data.id}`);
            document.getElementById('creditoForm').reset();
            cargarCreditos();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        });
    });

    // Editar crédito
    window.editarCredito = function(id) {
        fetch(`/api/creditos/${id}`)
            .then(response => {
                if (!response.ok) throw new Error('Error en la respuesta');
                return response.json();
            })
            .then(credito => {
                
                document.getElementById('editId').value = credito.id;
                document.getElementById('editCliente').value = credito.cliente;
                document.getElementById('editMonto').value = credito.monto;
                document.getElementById('editTasaInteres').value = credito.tasa_interes;
                document.getElementById('editPlazo').value = credito.plazo;
                document.getElementById('editFechaOtorgamiento').value = credito.fecha_otorgamiento;
                
                // Mostrar el modal con  Bootstrap
                const modal = new bootstrap.Modal(document.getElementById('editModal'));
                modal.show();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error al cargar el crédito: ' + error.message);
            });
    };

    // Enviar edición
    document.getElementById('editCreditoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        
        const creditoActualizado = {
            cliente: document.getElementById('editCliente').value,
            monto: parseFloat(document.getElementById('editMonto').value),
            tasa_interes: parseFloat(document.getElementById('editTasaInteres').value),
            plazo: parseInt(document.getElementById('editPlazo').value),
            fecha_otorgamiento: document.getElementById('editFechaOtorgamiento').value
        };

        fetch(`/api/creditos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(creditoActualizado)
        })
        .then(response => {
            if (!response.ok) throw new Error('Error al actualizar');
            return response.json();
        })
        .then(data => {
            alert(data.mensaje);
            const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
            modal.hide();
            cargarCreditos();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al actualizar: ' + error.message);
        });
    });

    // Eliminar crédito
window.eliminarCredito = function(id) {
    if (confirm('¿Confirmas que deseas eliminar este crédito?')) {
        fetch(`/api/creditos/${id}`, { 
            method: 'DELETE' 
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            alert(data.mensaje);
            cargarCreditos();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al eliminar el crédito: ' + error.message);
        });
    }
};

    // Cargar datos iniciales
    cargarCreditos();
    actualizarGrafica('total');  // Cargar gráfica inicial
});