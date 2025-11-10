from datetime import datetime
from unicodedata import category
import uuid
from google.cloud import firestore
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash



# Load environment variables
load_dotenv()

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Inicjalizacja Firestore
FIRESTORE_KEY_PATH = os.getenv('FIRESTORE_KEY_PATH', 'config/serviceAccount.json')

try:
    db = firestore.Client.from_service_account_json(FIRESTORE_KEY_PATH)
    print('Firestore initialized successfully in database.py')
except Exception as e:
    print(f'Error initializing Firestore in database.py: {str(e)}')
    db = None


# ✅ Funkcja pomocnicza do wyboru nazwy kolekcji
def get_teams_collection():
    """
    Zwraca nazwę kolekcji teams w zależności od środowiska
    """
    if ENVIRONMENT == 'production':
        return 'teams'
    else:
        return 'teams_test'
    

def ensure_teams_collection_exists():
    """
    Sprawdza czy kolekcja teams istnieje, jeśli nie - tworzy ją z dokumentem inicjalizującym
    
    Returns:
        bool: True jeśli kolekcja istnieje lub została utworzona, False w przypadku błędu
    """
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        
        # Sprawdź czy kolekcja istnieje poprzez próbę pobrania dokumentów
        docs = db.collection(collection_name).limit(1).stream()
        
        # Sprawdź czy kolekcja ma jakiekolwiek dokumenty
        has_documents = False
        for _ in docs:
            has_documents = True
            break
        
        if not has_documents:
            print(f'Collection {collection_name} does not exist or is empty. Creating...')
            
            # Utwórz dokument inicjalizujący (może być usunięty później)
            init_doc_ref = db.collection(collection_name).document('_init')
            init_doc_ref.set({
                'created_at': datetime.now(),
                'description': 'Initial document to create collection',
                'can_be_deleted': True
            })
            
            print(f'Collection {collection_name} created successfully with initial document')
            
            # Opcjonalnie: usuń dokument inicjalizujący
            # init_doc_ref.delete()
            
        else:
            print(f'Collection {collection_name} already exists')
        
        return True
        
    except Exception as e:
        print(f'Error ensuring collection exists: {str(e)}')
        return False


def initialize_database():
    """
    Inicjalizuje bazę danych - tworzy wymagane kolekcje
    Wywołaj tę funkcję przy starcie aplikacji
    """
    if not db:
        print('Cannot initialize database - Firestore not connected')
        return False
    
    try:
        # Upewnij się, że kolekcja teams istnieje
        ensure_teams_collection_exists()
        
        print('Database initialization completed')
        return True
        
    except Exception as e:
        print(f'Error initializing database: {str(e)}')
        return False



def get_team_stats(team_name):
    """
    Pobiera statystyki zespołu z Firestore
    """
    if not db:
        print('Firestore not initialized')
        return None
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            return {
                'team_name': team_name,
                'stats': {
                    'questions_generated': 0,
                    'categories': {}
                }
            }
        
        team_data = team_doc.to_dict()
        return {
            'team_name': team_name,
            'stats': team_data.get('stats', {}),
            'created_at': team_data.get('created_at')
        }
        
    except Exception as e:
        print(f'Error getting stats: {str(e)}')
        return None


# dodaj punkty druzynie za prowidłową odpowiedź
def add_points_to_team(team_name, category_id, points):
    """
    Dodaje punkty do zespołu w Firestore
    
    Args:
        team_name (str): Nazwa zespołu
        points (int): Liczba punktów do dodania
    """
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f'Team {team_name} does not exist')
            return False
        
        team_data = team_doc.to_dict()
        stats = team_data.get('stats', {})

        print(f'Current stats before update: {stats}')
        
        categories = stats.get('categories', {})
        
        # Jeśli kategoria istnieje, dodaj punkty
        if category_id in categories:
            categories[category_id]['points'] = categories[category_id].get('points', 0) + points

        # Dodaj punkty do ogólnej puli punktów
        stats['total_points'] = stats.get('total_points', 0) + points
        
        # Zaktualizuj dokument
        team_ref.update({'stats': stats})
        print(f'Added {points} points to team: {team_name}')
        
        return True
        
    except Exception as e:
        print(f'Error adding points to team: {str(e)}')
        return False


# zaktualizuj licznik wygenerowanych pytań dla kategorii
def update_questions_generated_counter(team_name, category_id, category_name):
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f'Team {team_name} does not exist')
            return False
        
        team_data = team_doc.to_dict()
        stats = team_data.get('stats', {})
        print(f'Current stats before update: {stats}')
        
        categories = stats.get('categories', {})
        
        # Jeśli kategoria nie istnieje, zainicjuj ją
        if category_id not in categories:
            categories[category_id] = {
                "name": category_name,
                'generated': 1,
                'correct': 0,
                'incorrect': 0,
                'points': 0
            }

        else:
            # Zwiększ licznik
            categories[category_id]['generated'] = categories[category_id].get('generated', 0) + 1

        # zwiększ ogólny licznik wygenerowanych pytań
        stats['questions_generated'] = stats.get('questions_generated', 0) + 1
        
        # Zaktualizuj statystyki
        stats['categories'] = categories
        
        # Zaktualizuj dokument
        team_ref.update({'stats': stats})
        print(f'Updated questions generated counter for team: {team_name}')
        
        return True
        
    except Exception as e:
        print(f'Error updating questions generated counter: {str(e)}')
        return False

# zaktualizuj licznik prawidłowych odpowiedzi zespołu
def update_correct_answers_counter(team_name, category_id):
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f'Team {team_name} does not exist')
            return False
        
        team_data = team_doc.to_dict()
        stats = team_data.get('stats', {})

        
        categories = stats.get('categories', {})
        category_id = str(category_id)
        
        print(f"category_id:" , category_id)
        if category_id in categories:
            # Zwiększ licznik
            categories[category_id]['correct'] = categories[category_id].get('correct', 0) + 1

        #zwiększ ogólny licznik poprawnych odpowiedzi
        stats['correct_answers'] = stats.get('correct_answers', 0) + 1

        #zwiększ licznik pytań odpowiedzianych
        stats['questions_answered'] = stats.get('questions_answered', 0) + 1

        # Zaktualizuj dokument
        team_ref.update({'stats': stats})
        print(f'Updated correct answers counter for team: {team_name}')
        
        return True
        
    except Exception as e:
        print(f'Error updating answers correct counter: {str(e)}')
        return False
    
# zaktualizuj licznik prawidłowych odpowiedzi zespołu
def update_incorrect_answers_counter(team_name, category_id):
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f'Team {team_name} does not exist')
            return False
        
        team_data = team_doc.to_dict()
        stats = team_data.get('stats', {})

        
        categories = stats.get('categories', {})
        category_id = str(category_id)
        
        print(f"category_id:" , category_id)
        if category_id in categories:
            # Zwiększ licznik
            categories[category_id]['incorrect'] = categories[category_id].get('incorrect', 0) + 1

        #zwiększ ogólny licznik poprawnych odpowiedzi
        stats['incorrect_answers'] = stats.get('incorrect_answers', 0) + 1

        #zwiększ licznik pytań odpowiedzianych
        stats['questions_answered'] = stats.get('questions_answered', 0) + 1

        # Zaktualizuj dokument
        team_ref.update({'stats': stats})
        print(f'Updated incorrect answers counter for team: {team_name}')
        
        return True
        
    except Exception as e:
        print(f'Error updating answers incorrect counter: {str(e)}')
        return False
    



# Walidacja sesji zespołu
def validate_team_session(team_name, team_id):
    """
    Sprawdza czy team_id z sesji zgadza się z team_id w bazie danych
    
    Args:
        team_name (str): Nazwa zespołu z sesji
        team_id (str): ID zespołu z sesji
    
    Returns:
        bool: True jeśli sesja jest prawidłowa, False w przeciwnym razie
    """
    if not db:
        print('Firestore not initialized')
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f'Team {team_name} does not exist')
            return False
        
        team_data = team_doc.to_dict()
        stored_team_id = team_data.get('id')
        
        # Porównaj ID z sesji z ID z bazy
        if stored_team_id != team_id:
            print(f'Team ID mismatch for {team_name}: session={team_id}, db={stored_team_id}')
            return False
        
        print(f'Team session validated successfully for {team_name}')
        return True
        
    except Exception as e:
        print(f'Error validating team session: {str(e)}')
        return False


def team_exists(team_name):
    """
    Sprawdza czy zespół o danej nazwie już istnieje
    """
    if not db:
        return None
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        return team_ref.get().exists
    except Exception as e:
        print(f'Error checking if team exists: {str(e)}')
        return None


def create_team(team_name, password, email=None):
    """
    Tworzy nowy zespół w bazie danych
    
    Args:
        team_name (str): Nazwa zespołu (login)
        password (str): Hasło w formie jawnej (zostanie zahashowane)
        email (str, optional): Email zespołu
    
    Returns:
        dict: {'success': bool, 'message': str, 'error': str}
    """
    if not db:
        return {'success': False, 'error': 'Database not initialized'}
    

    # Walidacja nazwy zespołu
    if not team_name or len(team_name) < 3:
        return {'success': False, 'error': 'Team name must be at least 3 characters'}
    
    if len(team_name) > 50:
        return {'success': False, 'error': 'Team name must be less than 50 characters'}
    
    # Walidacja hasła
    if not password or len(password) < 8:
        return {'success': False, 'error': 'Password must be at least 8 characters'}
    
    try:
        # Firestore automatycznie utworzy kolekcję przy pierwszym .set()
        collection_name = get_teams_collection()

        # Sprawdź czy zespół już istnieje
        if team_exists(team_name):
            return {'success': False, 'error': 'Team name already exists'}
        
        # Utwórz dokument zespołu
        team_ref = db.collection(collection_name).document(team_name)
        team_data = {
            'id': uuid.uuid4().hex,
            'password_hash': generate_password_hash(password),
            'created_at': datetime.now(),
            'last_login': None,
            'is_active': True,
            'failed_login_attempts': 0,
            'stats': {
                'questions_generated': 0,
                'questions_answered': 0,
                'correct_answers': 0,
                'incorrect_answers': 0,
                'accuracy_percentage': 0.0,
                'total_points': 0,
                'current_streak': 0,
                'best_streak': 0,
                'total_play_time_seconds': 0,
                'categories': {}
            }
        }
        
        # Dodaj email jeśli podano
        if email:
            team_data['email'] = email
        
        team_ref.set(team_data)
        print(f'Team created successfully: {team_name}')
        
        return {
            'success': True,
            'message': 'Team created successfully',
            'team_name': team_name,
            'team_id': team_data['id'],
            'team_data': {
                'created_at': team_data.get('created_at'),
                'last_login': datetime.now(),
                'stats': team_data.get('stats', {})
            }
        }
        
    except Exception as e:
        print(f'Error creating team: {str(e)}')
        return {'success': False, 'error': str(e)}


def authenticate_team(team_name, password):
    """
    Weryfikuje dane logowania zespołu
    
    Args:
        team_name (str): Nazwa zespołu
        password (str): Hasło w formie jawnej
    
    Returns:
        dict: {'success': bool, 'message': str, 'error': str, 'team_data': dict}
    """
    if not db:
        return {'success': False, 'error': 'Database not initialized'}
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        if team_name == "guest" and password == "guestpassword":
            if_exists = team_exists(team_name)
            if not if_exists:
                create_team("guest", "guestpassword")
            else:
                pass

        # pobierz ponownie dokument zespołu po ewentualnym utworzeniu
        team_doc = team_ref.get()
        
        # Sprawdź czy zespół istnieje
        if not team_doc.exists:
            return {'success': False, 'error': 'Invalid team name or password'}
        
        team_data = team_doc.to_dict()
        
        # Sprawdź czy konto jest aktywne
        if not team_data.get('is_active', True):
            return {'success': False, 'error': 'Account is disabled'}
        
        # Sprawdź liczbę nieudanych prób (opcjonalne)
        failed_attempts = team_data.get('failed_login_attempts', 0)
        if failed_attempts >= 5:
            return {'success': False, 'error': 'Account locked due to too many failed attempts'}
        
        # Sprawdź hasło
        if team_name != "guest" and password != "guestpassword":
            if not check_password_hash(team_data['password_hash'], password):
                # Zwiększ licznik nieudanych prób
                team_ref.update({
                    'failed_login_attempts': firestore.Increment(1)
                })
                return {'success': False, 'error': 'Invalid team name or password'}

            
        # Logowanie udane - zaktualizuj dane
        team_ref.update({
            'last_login': datetime.now(),
            'failed_login_attempts': 0  # Zresetuj licznik
        })
        
        print(f'Team logged in successfully: {team_name}')
        
        return {
            'success': True,
            'message': 'Login successful',
            'team_name': team_name,
            'team_id': team_data.get('id'),
            'team_data': {
                'created_at': team_data.get('created_at'),
                'last_login': datetime.now(),
                'stats': team_data.get('stats', {})
            }
        }
        
    except Exception as e:
        print(f'Error authenticating team: {str(e)}')
        return {'success': False, 'error': str(e)}


def update_team_stats_answer(team_name, category, is_correct, points=0, time_taken=0):
    """
    Aktualizuje statystyki po udzieleniu odpowiedzi
    
    Args:
        team_name (str): Nazwa zespołu
        category (str): ID kategorii
        is_correct (bool): Czy odpowiedź była poprawna
        points (int): Zdobyte punkty
        time_taken (int): Czas odpowiedzi w sekundach
    """
    if not db:
        return False
    
    try:
        collection_name = get_teams_collection()
        team_ref = db.collection(collection_name).document(team_name)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            return False
        
        team_data = team_doc.to_dict()
        stats = team_data.get('stats', {})
        
        # Aktualizuj ogólne statystyki
        stats['questions_answered'] = stats.get('questions_answered', 0) + 1
        
        if is_correct:
            stats['correct_answers'] = stats.get('correct_answers', 0) + 1
            stats['current_streak'] = stats.get('current_streak', 0) + 1
            stats['best_streak'] = max(
                stats.get('best_streak', 0),
                stats.get('current_streak', 0)
            )
        else:
            stats['incorrect_answers'] = stats.get('incorrect_answers', 0) + 1
            stats['current_streak'] = 0
        
        # Oblicz procent poprawności
        total_answered = stats['questions_answered']
        if total_answered > 0:
            stats['accuracy_percentage'] = round(
                (stats['correct_answers'] / total_answered) * 100, 2
            )
        
        stats['total_points'] = stats.get('total_points', 0) + points
        stats['total_play_time_seconds'] = stats.get('total_play_time_seconds', 0) + time_taken
        
        # Aktualizuj statystyki kategorii
        categories = stats.get('categories', {})
        if category not in categories:
            categories[category] = {'generated': 0, 'correct': 0, 'incorrect': 0}
        
        if is_correct:
            categories[category]['correct'] = categories[category].get('correct', 0) + 1
        else:
            categories[category]['incorrect'] = categories[category].get('incorrect', 0) + 1
        
        stats['categories'] = categories
        
        # Zapisz zaktualizowane statystyki
        team_ref.update({'stats': stats})
        print(f'Updated answer stats for team: {team_name}')
        
        return True
        
    except Exception as e:
        print(f'Error updating team stats: {str(e)}')
        return False
