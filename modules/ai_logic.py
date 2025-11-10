from flask import Blueprint, Flask, app, render_template, jsonify, make_response, session
import os
import json
import requests
from flask import request
from dotenv import load_dotenv
from google.cloud import firestore


load_dotenv()

# Utwórz Blueprint
bp = Blueprint('ai', __name__)

# Załaduj zmienne środowiskowe
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_API_URL = os.getenv('GEMINI_API_URL', '')

# Wczytaj prompty
try:
    with open('static/data/prompts.json', 'r', encoding='utf-8') as f:
        prompts_data = json.load(f)
        PROMPTS_TYPE = prompts_data.get('introduction_prompts', [])
except:
    PROMPTS_TYPE = []


@bp.route('/generate-description', methods=['GET'])
def generate_description():
    # Pobierz parametry z żądania
    category = request.args.get('category', '')
    temperature = request.args.get('temperature', '0.5')
    print(f"Temperature received: {temperature}")
    question = request.args.get('question', '')
    correct_answer = request.args.get('correct_answer', '')
    incorrect_answers = request.args.get('incorrect_answers', '')
    prompt_type = request.args.get('prompt_type', '')

    if prompt_type:
        for prompt in PROMPTS_TYPE:
            if prompt['id'] == prompt_type:
                # Wydobądź wartości 'text' z zagnieżdżonych obiektów
                system_instruction = prompt['modality']['systemInstruction']  # Usuń [0] - to nie jest tablica
                systemInstruction_parts = []
                
                # Iteruj przez klucze w systemInstruction (role, descriptionTask, etc.)
                for key, value in system_instruction.items():
                    if isinstance(value, dict) and 'text' in value:
                        systemInstruction_parts.append({"text": value['text']})
                
                print(f"System instruction parts for prompt type {prompt_type}: {systemInstruction_parts}")
                
                # Wydobądź description z generationConfig
                introduction_prompt_type_description = prompt['modality']['generationConfig']['introduction']['description']
                print(f"Using introduction prompt type id {prompt_type}")
                break
        else:
            # Jeśli nie znaleziono promptu, użyj domyślnych wartości
            systemInstruction_parts = [
                {"text": "Jesteś ekspertem ds. edukacji i tworzenia treści kontekstowych."},
                {"text": "Twoim zadaniem jest wygenerowanie 5-zdaniowego wprowadzenia do zadanego tematu pytania."},
                {"text": "oraz 5-zdaniowego podsumowania rozwijającego kontekst prawidłowej odpowiedzi."},
                {"text": "Dodatkowo, wygeneruj listę najciekawszych terminów, które znajdują się w treści wprowadzenia i podsumowania, dla których użytkownik może chcieć pogłębić wiedzę."},
                {"text": "Odpowiedzi muszą być precyzyjne, edukacyjne i generowane **tylko w języku polskim**."}
            ]
            introduction_prompt_type_description = "Pięciozdaniowe wprowadzenie do tematu pytania, nakreślające kontekst i znaczenie zagadnienia."
    else:
        # Domyślne wartości gdy nie wybrano typu promptu
        systemInstruction_parts = [
            {"text": "Jesteś ekspertem ds. edukacji i tworzenia treści kontekstowych."},
            {"text": "Twoim zadaniem jest wygenerowanie 5-zdaniowego wprowadzenia do zadanego tematu pytania."},
            {"text": "oraz 5-zdaniowego podsumowania rozwijającego kontekst prawidłowej odpowiedzi."},
            {"text": "Dodatkowo, wygeneruj listę najciekawszych terminów, które znajdują się w treści wprowadzenia i podsumowania, dla których użytkownik może chcieć pogłębić wiedzę."},
            {"text": "Odpowiedzi muszą być precyzyjne, edukacyjne i generowane **tylko w języku polskim**."}
        ]
        introduction_prompt_type_description = "Pięciozdaniowe wprowadzenie do tematu pytania, nakreślające kontekst i znaczenie zagadnienia."


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
            "parts": systemInstruction_parts
        },
        "generationConfig": {
            "temperature":  float(temperature),
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "wprowadzenie": {
                        "type": "string",
                        "description": introduction_prompt_type_description
                    },
                    "podsumowanie": {
                        "type": "string",
                        "description": "Pięciozdaniowe rozszerzenie informacyjne na temat prawidłowej odpowiedzi, wyjaśniające jej znaczenie i kontekst."
                    },
                    "słowa_kluczowe": {
                        "type": "array",
                        "description": "Lista kluczowych terminów, nazw własnych, definicji lub dat z tekstu wprowadzenia i podsumowania, które mogą być interesujące i moga wymagać pogłębienia wiedzy. Wygenerowane wartości muszą mieć ten sam zapis jak w wprowadzeniu i podsumowaniu.",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": ["wprowadzenie", "podsumowanie", "słowa_kluczowe"]
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
                'podsumowanie': parsed_content.get('podsumowanie', ''),
                'slowa_kluczowe': parsed_content.get('słowa_kluczowe', [])
            }), 200
        else:
            return jsonify({'error': 'No valid response from Gemini API'}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Request error: {str(e)}'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'error': f'JSON parsing error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@bp.route('/get-keyword-definition', methods=['GET'])
def get_keyword_definition():
    try:
        keyword = request.args.get('keyword', '')
        temperature = float(request.args.get('temperature', 0.5))
        question = request.args.get('question', '')
        
        if not keyword:
            return jsonify({'error': 'Keyword parameter is required'}), 400

        # Zmodyfikowany prompt z kontekstem pytania
        if question:
            user_prompt = f"Wyjaśnij w 3-4 zdaniach co oznacza termin: '{keyword}'. Odpowiedź powinna być zwięzła, merytoryczna i edukacyjna. Pamiętaj, że wyjaśnienie jest w kontekście pytania: '{question}', ale NIE MOŻESZ zdradzić odpowiedzi na to pytanie."
        else:
            user_prompt = f"Wyjaśnij w 3-4 zdaniach co oznacza termin: '{keyword}'. Odpowiedź powinna być zwięzła, merytoryczna i edukacyjna."

        gemini_request = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [
                    {
                        "text": "Jesteś ekspertem edukacyjnym. Twoim zadaniem jest wyjaśnianie pojęć w usystematyzowany sposób podając definicje, rozwijając je oraz przywołując przykłady. "
                               "Odpowiedzi generuj **tylko w języku polskim**. "
                               "WAŻNE: Jeśli wyjaśnienie jest w kontekście pytania quizowego, NIE MOŻESZ w żaden sposób sugerować ani zdradzać prawidłowej odpowiedzi. "
                               "Skup się na ogólnym wyjaśnieniu terminu bez wskazywania konkretnych odpowiedzi."
                    }
                ]
            },
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "text/plain"
            }
        }

        headers = {'Content-Type': 'application/json'}
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        
        response = requests.post(url, headers=headers, json=gemini_request, timeout=30)
        response.raise_for_status()
        gemini_response = response.json()

        if 'candidates' in gemini_response and len(gemini_response['candidates']) > 0:
            definition = gemini_response['candidates'][0]['content']['parts'][0]['text']
            
            return jsonify({'definition': definition}), 200
        else:
            return jsonify({'error': 'No valid response from Gemini API'}), 500

    except Exception as e:
        app.logger.error(f'Error getting keyword definition: {str(e)}', exc_info=True)
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500