from flask import Flask, render_template, jsonify, make_response
import os
import json
import requests
from flask import request
from dotenv import load_dotenv

app = Flask(__name__)

# Load environment variables
ENVIRONMENT = os.getenv('ENVIRONMENT', 'local')
# Load .env file
load_dotenv()
QUIZ_CATEGORIES = os.getenv('QUIZ_CATEGORIES', 'api_quiz_categories')
QUIZ_DATA = os.getenv('QUIZ_DATA', 'api_quiz')
QUESTION_DESCRIPTION = os.getenv('QUESTION_DESCRIPTION', 'api_question_description')

QUIZ_API_PROVIDERS = os.getenv('QUIZ_API_PROVIDERS', '')
AI_API_PROVIDERS = os.getenv('AI_API_PROVIDERS', '')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_API_URL = os.getenv('GEMINI_API_URL', '')
TRIVIA_API_URL = os.getenv('TRIVIA_API_URL', 'https://opentdb.com/api.php')

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

@app.route('/')
def index():
    resp = make_response(render_template('index.html'))
    return resp

@app.route('/game')
def game():
    resp = make_response(render_template('game.html'))
    resp.set_cookie('quiz_api_providers', QUIZ_API_PROVIDERS)
    resp.set_cookie('ai_api_providers', AI_API_PROVIDERS)
    resp.set_cookie('quiz_categories', QUIZ_CATEGORIES)
    resp.set_cookie('quiz_data', QUIZ_DATA)
    resp.set_cookie('question_description', QUESTION_DESCRIPTION)
    return resp

@app.route('/api/get-questions', methods=['GET'])
def get_questions():
    amount = request.args.get('amount', 1)
    category = request.args.get('category', '')
    difficulty = request.args.get('difficulty', '')
    question_type = request.args.get('type', '')

    base_url = TRIVIA_API_URL
    params = {'amount': amount}
    if category:
        params['category'] = category
    if difficulty:
        params['difficulty'] = difficulty
    if question_type:
        params['type'] = question_type

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/generate-description', methods=['GET'])
def generate_description():
    # Pobierz parametry z żądania
    category = request.args.get('category', '')
    question = request.args.get('question', '')
    correct_answer = request.args.get('correct_answer', '')
    incorrect_answers = request.args.get('incorrect_answers', '')

    # Sprawdź czy klucz API jest ustawiony
    if not GEMINI_API_KEY or not GEMINI_API_URL:
        app.logger.error('GEMINI_API_KEY or GEMINI_API_URL not set')
        return jsonify({'error': 'API configuration missing'}), 500

    # Przygotuj prompt dla Gemini
    user_prompt = f"Wygeneruj treści na podstawie poniższych danych. Kategoria: '{category}'. Pytanie: '{question}'. Prawidłowa odpowiedź: '{correct_answer}'. Błędne odpowiedzi: '{incorrect_answers}'"

    # Przygotuj request body dla Gemini API
    gemini_request = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": user_prompt
                    }
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": "Jesteś ekspertem ds. edukacji i tworzenia treści kontekstowych. Twoim zadaniem jest wygenerowanie 5-zdaniowego wprowadzenia do zadanego tematu pytania oraz 5-zdaniowego podsumowania rozwijającego kontekst prawidłowej odpowiedzi. Odpowiedzi muszą być precyzyjne, edukacyjne i generowane **tylko w języku polskim**."
                }
            ]
        },
        "generationConfig": {
            "temperature": 0.5,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "wprowadzenie": {
                        "type": "string",
                        "description": "Pięciozdaniowe wprowadzenie do tematu pytania, nakreślające kontekst i znaczenie zagadnienia."
                    },
                    "podsumowanie": {
                        "type": "string",
                        "description": "Pięciozdaniowe rozszerzenie informacyjne na temat prawidłowej odpowiedzi, wyjaśniające jej znaczenie i kontekst."
                    }
                },
                "required": ["wprowadzenie", "podsumowanie"]
            }
        }
    }

    try:
        # Wyślij żądanie do Gemini API
        headers = {
            'Content-Type': 'application/json'
        }
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        response = requests.post(url, headers=headers, json=gemini_request)
        response.raise_for_status()
        gemini_response = response.json()

        # Zapisz pełną odpowiedź do pliku
        with open('static/data/api_response.json', 'w', encoding='utf-8') as f:
            json.dump(gemini_response, f, ensure_ascii=False, indent=2)

        # Wydobądź wprowadzenie i podsumowanie
        if 'candidates' in gemini_response and len(gemini_response['candidates']) > 0:
            content = gemini_response['candidates'][0]['content']['parts'][0]['text']
            # Parse JSON z text field
            parsed_content = json.loads(content)
            
            return jsonify({
                'wprowadzenie': parsed_content.get('wprowadzenie', ''),
                'podsumowanie': parsed_content.get('podsumowanie', '')
            }), 200
        else:
            return jsonify({'error': 'No valid response from Gemini API'}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Request error: {str(e)}'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'error': f'JSON parsing error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)