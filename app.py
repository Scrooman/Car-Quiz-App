from flask import Flask, render_template, jsonify, make_response, session
import os
import json
import requests
from flask import request
from dotenv import load_dotenv
from google.cloud import firestore

# Importuj moduły
from modules import ai_logic, quiz, auth
from database import get_team_stats, db

from database import get_team_stats, db

# Load .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-here')  # Dodaj do .env


# Zarejestruj Blueprinty
app.register_blueprint(ai_logic.bp, url_prefix='/api')
app.register_blueprint(quiz.bp, url_prefix='/api')
app.register_blueprint(auth.bp, url_prefix='/api/auth')


# Load environment variables
ENVIRONMENT = os.getenv('ENVIRONMENT', 'local')

QUIZ_CATEGORIES = os.getenv('QUIZ_CATEGORIES', 'api_quiz_categories')
QUIZ_DATA = os.getenv('QUIZ_DATA', 'api_quiz')
QUESTION_DESCRIPTION = os.getenv('QUESTION_DESCRIPTION', 'api_question_description')

QUIZ_API_PROVIDERS = os.getenv('QUIZ_API_PROVIDERS', '')
AI_API_PROVIDERS = os.getenv('AI_API_PROVIDERS', '')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_API_URL = os.getenv('GEMINI_API_URL', '')
TRIVIA_API_URL = os.getenv('TRIVIA_API_URL', 'https://opentdb.com/api.php')


# Sprawdź czy Firestore jest zainicjalizowany
if db:
    app.logger.info('Firestore connection available in app.py')
else:
    app.logger.warning('Firestore not available in app.py')

# Load local API providers if running locally
if ENVIRONMENT == 'local':
    with open('static/data/local_api_providers.json') as f:
        local_api_providers = json.load(f)
    with open('static/data/local_quiz_categories.json') as f:
        local_quiz_categories = json.load(f)
    with open('static/data/local_quiz.json') as f:
        local_quiz = json.load(f)

else:
    local_api_providers = {
        "quiz_api": os.getenv('QUIZ_API_PROVIDERS', '').split(','),
        "ai_api": os.getenv('AI_API_PROVIDERS', '').split(',')
    }

# Wczytaj prompty z pliku JSON
try:
    with open('static/data/prompts.json', 'r', encoding='utf-8') as f:
        prompts_data = json.load(f)
        PROMPTS_TYPE = prompts_data.get('introduction_prompts', [])
except FileNotFoundError:
    PROMPTS_TYPE = []
    app.logger.warning('prompts.json file not found')
except json.JSONDecodeError:
    PROMPTS_TYPE = []
    app.logger.error('Error parsing prompts.json')
    

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    return resp


@app.route('/game')
@auth.login_required
def game():

    resp = make_response(render_template('game.html', prompt_type=PROMPTS_TYPE))
    #resp.set_cookie('quiz_api_providers', QUIZ_API_PROVIDERS)
    #resp.set_cookie('ai_api_providers', AI_API_PROVIDERS)
    resp.set_cookie('quiz_categories', QUIZ_CATEGORIES)
    resp.set_cookie('quiz_data', QUIZ_DATA)
    resp.set_cookie('question_description', QUESTION_DESCRIPTION)
    return resp

   


@app.route('/api/get-stats', methods=['GET'])
def get_stats():
    """
    Pobiera statystyki zespołu z Firestore
    """
    team_name = request.args.get('team_name', session.get('team_name', 'default_team'))
    
    stats = get_team_stats(team_name)
    
    if stats is None:
        return jsonify({'error': 'Failed to get stats'}), 500
    
    return jsonify(stats), 200

if __name__ == '__main__':
    app.run(debug=True)