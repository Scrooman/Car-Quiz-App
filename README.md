# Car Quiz App

Aplikacja quizowa wykorzystująca API Trivia oraz Google Gemini do generowania kontekstu pytań.

## Wymagania

- Python 3.9+
- Flask
- Klucz API Google Gemini

## Instalacja lokalna

1. Sklonuj repozytorium
2. Zainstaluj zależności: `pip install -r requirements.txt`
3. Skopiuj `.env.example` do `.env` i uzupełnij klucze API
4. Uruchom aplikację: `python app.py`

## Zmienne środowiskowe

- `ENVIRONMENT` - środowisko (local/production)
- `GEMINI_API_KEY` - klucz API Google Gemini
- `GEMINI_API_URL` - URL API Gemini
- `QUIZ_CATEGORIES` - źródło kategorii (local_quiz_categories/api_quiz_categories)
- `QUIZ_DATA` - źródło pytań (local_quiz/api_quiz)
- `QUESTION_DESCRIPTION` - źródło opisów (local_question_description/api_question_description)