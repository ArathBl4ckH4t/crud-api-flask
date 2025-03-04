from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import sqlite3
from datetime import datetime
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.secret_key = 'Deltadata12!'

DATABASE = 'creditos.db'

ADMIN_CREDENTIALS = {
    'username': 'Deltadata12!',
    'password': 'Deltadata12!'
}

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_CREDENTIALS['username'] and password == ADMIN_CREDENTIALS['password']:
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='Credenciales incorrectas')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# Proteger todas las rutas
@app.before_request
def require_login():
    allowed_routes = ['login', 'static']
    if request.endpoint not in allowed_routes and not session.get('logged_in'):
        return redirect(url_for('login'))


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS creditos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT NOT NULL,
            monto REAL NOT NULL,
            tasa_interes REAL NOT NULL,
            plazo INTEGER NOT NULL,
            fecha_otorgamiento TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# Inicializar la base de datos al iniciar la app
# Importante
init_db()

@app.route('/api/creditos', methods=['POST'])
def crear_credito():
    data = request.get_json()
    cliente = data.get('cliente')
    monto = data.get('monto')
    tasa_interes = data.get('tasa_interes')
    plazo = data.get('plazo')
    fecha_otorgamiento = data.get('fecha_otorgamiento')  

    # Validaciones 
    if not all([cliente, monto, tasa_interes, plazo, fecha_otorgamiento]):
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    # validación de formato de fecha 
    try:
        datetime.strptime(fecha_otorgamiento, '%Y-%m-%d')
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido, debe ser YYYY-MM-DD'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO creditos (cliente, monto, tasa_interes, plazo, fecha_otorgamiento)
        VALUES (?, ?, ?, ?, ?)
    ''', (cliente, monto, tasa_interes, plazo, fecha_otorgamiento))
    conn.commit()
    nuevo_id = cursor.lastrowid
    conn.close()

    return jsonify({'mensaje': 'Crédito registrado', 'id': nuevo_id}), 201

@app.route('/api/creditos', methods=['GET'])
def listar_creditos():
    conn = get_db_connection()
    creditos = conn.execute('SELECT * FROM creditos').fetchall()
    conn.close()

    # Convertir resultados a lista 
    creditos_list = [dict(c) for c in creditos]
    return jsonify(creditos_list)

@app.route('/api/creditos/<int:credito_id>', methods=['GET'])
def manejar_credito(credito_id):
    if request.method == 'GET':
        conn = get_db_connection()
        credito = conn.execute('SELECT * FROM creditos WHERE id = ?', (credito_id,)).fetchone()
        conn.close()
        
        if credito is None:
            return jsonify({'error': 'Crédito no encontrado'}), 404
            
        return jsonify(dict(credito))


@app.route('/api/creditos/<int:credito_id>', methods=['PUT'])
def actualizar_credito(credito_id):
    data = request.get_json()
    cliente = data.get('cliente')
    monto = data.get('monto')
    tasa_interes = data.get('tasa_interes')
    plazo = data.get('plazo')
    fecha_otorgamiento = data.get('fecha_otorgamiento')

    if not all([cliente, monto, tasa_interes, plazo, fecha_otorgamiento]):
        return jsonify({'error': 'Todos los campos son obligatorios'}), 400

    try:
        datetime.strptime(fecha_otorgamiento, '%Y-%m-%d')
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido, debe ser YYYY-MM-DD'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE creditos
        SET cliente = ?, monto = ?, tasa_interes = ?, plazo = ?, fecha_otorgamiento = ?
        WHERE id = ?
    ''', (cliente, monto, tasa_interes, plazo, fecha_otorgamiento, credito_id))
    conn.commit()
    conn.close()

    return jsonify({'mensaje': 'Crédito actualizado'})

@app.route('/api/creditos/<int:credito_id>', methods=['DELETE'])
def eliminar_credito(credito_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Verificar si el crédito existe en la base
        cursor.execute('SELECT * FROM creditos WHERE id = ?', (credito_id,))
        credito = cursor.fetchone()
        
        if not credito:
            return jsonify({'error': 'El crédito no existe'}), 404
            
        cursor.execute('DELETE FROM creditos WHERE id = ?', (credito_id,))
        conn.commit()
        
        return jsonify({'mensaje': 'Crédito eliminado correctamente'})
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
        
    finally:
        conn.close()

@app.route('/api/creditos/distribucion/cliente')
def distribucion_cliente():
    conn = get_db_connection()
    distribucion = conn.execute('''
        SELECT cliente, SUM(monto) as total 
        FROM creditos 
        GROUP BY cliente
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in distribucion])

@app.route('/api/creditos/distribucion/montos')
def distribucion_montos():
    conn = get_db_connection()
    distribucion = conn.execute('''
        SELECT 
            CASE
                WHEN monto <= 1000 THEN '0 - 1000'
                WHEN monto BETWEEN 1001 AND 5000 THEN '1001 - 5000'
                WHEN monto BETWEEN 5001 AND 10000 THEN '5001 - 10000'
                ELSE '10000+'
            END as rango,
            SUM(monto) as total,
            COUNT(*) as cantidad
        FROM creditos
        GROUP BY rango
        ORDER BY rango
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in distribucion])

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
