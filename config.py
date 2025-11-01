import os

class Config:
    DEBUG = os.getenv('DEBUG', 'False') == 'True'
    ENV = os.getenv('ENV', 'development')
    QUIZ_API_PROVIDERS = os.getenv('QUIZ_API_PROVIDERS', '').split(',')
    AI_API_PROVIDERS = os.getenv('AI_API_PROVIDERS', '').split(',')