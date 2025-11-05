document.addEventListener('DOMContentLoaded', () => {
    const quizApiContainer = document.getElementById('quiz-api-providers-buttons'); // było 'quiz-api-container'
    const aiApiContainer = document.getElementById('ai-api-providers-buttons');     // było 'ai-api-container'
    const startButton = document.getElementById('start-button');

    let selectedQuizApi = null;
    let selectedAiApi = null;

    // Fetch local API providers from JSON file
    fetch('/static/data/local_api_providers.json')
        .then(response => response.json())
        .then(data => {
            populateApiButtons(data.quiz_api, quizApiContainer, 'quiz');
            populateApiButtons(data.ai_api, aiApiContainer, 'ai');
        })
        .catch(error => console.error('Error fetching API providers:', error));

    function populateApiButtons(apiList, container, type) {
        apiList.forEach(api => {
            const button = document.createElement('button');
            button.textContent = api.name;
            button.classList.add('quiz-api-providers-button');
            
            button.addEventListener('click', () => {
                if (type === 'quiz') {
                    selectedQuizApi = api.name;
                    
                } else {
                    selectedAiApi = api.name;
                    
                }
                updateButtonStyles(container, type);
            });
            container.appendChild(button);
            // Disable button if it says "Coming Soon..."
            const disabledQuizButtons = container.querySelectorAll('.quiz-api-providers-button');
            for (const button of disabledQuizButtons) {
                if (button.textContent === "Coming Soon...") {
                    button.disabled = true;
                }
            }

            const disabledAiButtons = container.querySelectorAll('.ai-api-providers-button');
            for (const button of disabledAiButtons) {
                if (button.textContent === "Coming Soon...") {
                    button.disabled = true;
                }
            }
        });
    }

    function updateButtonStyles(container, type) {
        const buttons = container.querySelectorAll('.quiz-api-providers-button');
        buttons.forEach(button => {
            button.classList.remove('selected');
        });
        if (type === 'quiz' && selectedQuizApi) {
            const selectedButton = Array.from(buttons).find(button => button.textContent === selectedQuizApi);
            if (selectedButton) selectedButton.classList.add('selected');
        }
        if (type === 'ai' && selectedAiApi) {
            const selectedButton = Array.from(buttons).find(button => button.textContent === selectedAiApi);
            if (selectedButton) selectedButton.classList.add('selected');
        }
    }

    startButton.addEventListener('click', () => {
        if (selectedQuizApi && selectedAiApi) {
            sessionStorage.setItem('selectedQuizApi', selectedQuizApi);
            sessionStorage.setItem('selectedAiApi', selectedAiApi);
            window.location.href = '/game';
        } else {
            alert('Please select both a Quiz API and an AI API before starting the game.');
        }
    });
});