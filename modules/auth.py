from flask import Blueprint, request, jsonify, session
from database import create_team, authenticate_team, team_exists, validate_team_session

from functools import wraps
from flask import redirect, url_for, session, jsonify

bp = Blueprint('auth', __name__)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'team_name' not in session or not session.get('logged_in'):
            # Jeśli żądanie jest AJAX/API, zwróć 401, jeśli zwykłe - przekieruj
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'logged_in': False, 'error': 'Authentication required'}), 401
            return redirect(url_for('index'))
        
        # Opcjonalnie: sprawdź czy team_id jest w sesji (dodatkowe zabezpieczenie)
        if 'team_id' not in session:
            session.clear()  # Wyczyść nieprawidłową sesję
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'logged_in': False, 'error': 'Invalid session'}), 401
            return redirect(url_for('index'))
        
        # ✅ WALIDACJA: Sprawdź czy team_id z sesji zgadza się z bazą danych
        team_name = session.get('team_name')
        team_id = session.get('team_id')
        
        if not validate_team_session(team_name, team_id):
            # Sesja jest nieprawidłowa - wyczyść ją
            session.clear()
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({
                    'logged_in': False, 
                    'error': 'Session validation failed - please log in again'
                }), 401
            return redirect(url_for('index'))
        
        # Sesja jest ważna, kontynuuj
        return f(*args, **kwargs)
    return decorated_function


@bp.route('/register', methods=['POST'])
def register():
    """
    Endpoint rejestracji nowego zespołu
    
    Expected JSON:
    {
        "team_name": "string",
        "password": "string",
        "repeat_password": "string",
        "email": "string (optional)"
    }
    """
    try:
        data = request.json
        team_name = data.get('team_name', '').strip()
        password_hash = data.get('password', '')  # ✅ Odbierz hash
        repeat_password_hash = data.get('repeat_password', '')
        
        email = data.get('email', '').strip() or None
        
        # Walidacja danych wejściowych
        if not team_name:
            return jsonify({'success': False, 'error': 'Team name is required'}), 400
        
        if not password_hash:
            return jsonify({'success': False, 'error': 'Password is required'}), 400
        
        if password_hash != repeat_password_hash:
            return jsonify({'success': False, 'error': 'Passwords do not match'}), 400
        
        # Utwórz zespół
        result = create_team(team_name, password_hash, email)
        
        if result['success']:
            # Automatyczne logowanie po rejestracji
            session['team_name'] = team_name
            session['team_id'] = result.get('team_id')
            session['logged_in'] = True
            return jsonify({'success': True, 'message': 'Registration successful', 'result': result}), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/login', methods=['POST'])
def login():
    """
    Endpoint logowania zespołu
    
    Expected JSON:
    {
        "team_name": "string",
        "password": "string"
    }
    """
    try:
        data = request.json
        team_name = data.get('team_name', '').strip()
        password_hash = data.get('password', '')  # ✅ Odbierz hash
        
        if not team_name or not password_hash:
            return jsonify({'success': False, 'error': 'Team name and password are required'}), 400
        
        # Uwierzytelnij zespół
        result = authenticate_team(team_name, password_hash)
        
        if result['success']:
            # Zapisz w sesji
            session['team_name'] = team_name
            session['team_id'] = result.get('team_id')
            print(f"Team logged in successfully: {team_name}, ID: {session['team_id']}")
            session['logged_in'] = True
            return jsonify({'success': True, 'message': 'Log in successful', 'result': result}), 200
        else:
            return jsonify(result), 401
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/logout', methods=['POST'])
def logout():
    """
    Endpoint wylogowania
    """
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


@bp.route('/check-name', methods=['GET'])
def check_name():
    """
    Sprawdza czy nazwa zespołu jest dostępna
    """
    team_name = request.args.get('team_name', '').strip()
    
    if not team_name:
        return jsonify({'available': False, 'error': 'Team name is required'}), 400
    
    exists = team_exists(team_name)
    
    if exists is None:
        return jsonify({'error': 'Database error'}), 500
    
    return jsonify({'available': not exists}), 200


@bp.route('/current-user', methods=['GET'])
def current_user():
    """
    Zwraca informacje o zalogowanym użytkowniku
    """
    if 'team_name' not in session:
        return jsonify({'logged_in': False}), 401
    
    return jsonify({
        'logged_in': True,
        'team_name': session['team_name'],
        'team_id': session['team_id']
    }), 200