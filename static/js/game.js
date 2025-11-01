let quizCategories = [];
let quizData = [];
let selectedCategory = null;
let currentQuestionIndex = 0;
let introductionData = '';
let conclusionData = '';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    // Display the selected values on the game page
    const quizAPIContainer = document.getElementById('selected-quiz-api');
    const aiAPIContainer = document.getElementById('selected-ai-api');
    const quizCategoriesCookie = getCookie('quiz_categories');
    const quizDataCookie = getCookie('quiz_data');
    const questionDescriptionCookie = getCookie('question_description');
    const categoriesButtonsContainer = document.getElementById('quiz-categories-buttons');
    const getQuestionButton = document.getElementById('get-question-button');

    // Wyświetl wybrane API
    const selectedQuizAPI = getCookie('quiz_api_providers');
    const selectedAIAPI = getCookie('ai_api_providers');
    quizAPIContainer.textContent = selectedQuizAPI ? `Selected Quiz API: ${selectedQuizAPI}` : 'No Quiz API selected.';
    aiAPIContainer.textContent = selectedAIAPI ? `Selected AI API: ${selectedAIAPI}` : 'No AI API selected.';

    // Ładuj kategorie asynchronicznie
    if (quizCategoriesCookie === "local_quiz_categories") {
        fetch('/static/data/local_quiz_categories.json')
            .then(response => response.json())
            .then(data => {
                quizCategories = data.trivia_categories;
                renderCategoryButtons();
            })
            .catch(error => console.error('Error loading local quiz categories:', error));
    } else if (quizCategoriesCookie === "api_quiz_categories") {
        fetch('https://opentdb.com/api_category.php')
            .then(response => response.json())
            .then(data => {
                quizCategories = data.trivia_categories;
                renderCategoryButtons();
            })
            .catch(error => console.error('Error loading API quiz categories:', error));
    } else {
        console.log('No quiz categories cookie found.');
    }

    function loadQuestionsFromLocal() {
        return new Promise((resolve, reject) => {
            if (quizDataCookie === "local_quiz") {
                console.log('Loading local quiz data from /static/data/local_quiz.json...');
                fetch('/static/data/local_quiz.json')
                    .then(response => response.json())
                    .then(data => {
                        quizData = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                        console.log('Loaded local quiz data:', quizData);
                        resolve();
                    })
                    .catch(error => {
                        console.error('Error loading local quiz data:', error);
                        reject(error);
                    });
            } else {
                resolve();
            }
        });
    }

    function loadQuestionDescriptionFromLocal() {
        return new Promise((resolve, reject) => {
            if (questionDescriptionCookie === "local_question_description") {
                console.log('Loading local question description data from /static/data/local_question_description.json...');
                fetch('/static/data/local_question_description.json')
                    .then(response => response.json())
                    .then(data => {
                        console.log('Local description data fetched:', data);
                        introductionData = data.results.introduction || '';
                        console.log('Loaded local introduction data:', introductionData);
                        conclusionData = data.results.conclusion || '';
                        console.log('Loaded local conclusion data:', conclusionData);
                        resolve();
                    })
                    .catch(error => {
                        console.error('Error loading local question description data:', error);
                        reject(error);
                    });
            } else {
                resolve();
            }
        });
    }

    function loadQuestionDescriptionFromAPI(question) {
        return new Promise((resolve, reject) => {
            if (questionDescriptionCookie === "api_question_description") {
                console.log('Loading question description from Gemini API...');
                
                const params = new URLSearchParams({
                    category: question.category,
                    question: question.question,
                    correct_answer: question.correct_answer,
                    incorrect_answers: question.incorrect_answers.join(', ')
                });

                fetch(`/api/generate-description?${params.toString()}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.wprowadzenie && data.podsumowanie) {
                            introductionData = data.wprowadzenie;
                            conclusionData = data.podsumowanie;
                            console.log('Loaded API introduction data:', introductionData);
                            console.log('Loaded API conclusion data:', conclusionData);
                            resolve();
                        } else {
                            reject(new Error('Invalid response from description API'));
                        }
                    })
                    .catch(error => {
                        console.error('Error loading question description from API:', error);
                        reject(error);
                    });
            } else {
                resolve();
            }
        });
    }

    function loadQuestionsFromAPI() {
        return new Promise((resolve, reject) => {
            const difficulty = document.getElementById('difficulty').value;
            const type = document.getElementById('type').value;
            const category = selectedCategory ? selectedCategory.id : '';

            const params = new URLSearchParams({
                amount: 1,
                category: category,
                difficulty: difficulty,
                type: type
            });

            fetch(`/api/get-questions?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.results && Array.isArray(data.results)) {
                        quizData = data.results;
                        console.log('Loaded quiz data from API:', quizData);
                        resolve();
                    } else {
                        reject(new Error('No results from API'));
                    }
                })
                .catch(error => {
                    console.error('Error loading quiz data from API:', error);
                    reject(error);
                });
        });
    }

    function renderCategoryButtons() {
        if (quizCategories.length > 0 && categoriesButtonsContainer) {
            categoriesButtonsContainer.innerHTML = '';
            quizCategories.forEach(category => {
                const btn = document.createElement('button');
                btn.textContent = category.name;
                btn.className = 'category-btn';
                btn.dataset.categoryId = category.id;
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedCategory = category;
                    localStorage.setItem('selectedCategory', JSON.stringify(category));
                    console.log('Selected category:', category);
                });
                categoriesButtonsContainer.appendChild(btn);
            });
        } else {
            console.log('No categories to display or container not found');
        }
    }

    async function loadAndDisplayNextQuestion() {
        try {
            // Sprawdź czy to tryb lokalny czy API
            if (quizDataCookie === "local_quiz") {
                await loadQuestionsFromLocal();
            } else {
                await loadQuestionsFromAPI();
            }

            if (!Array.isArray(quizData) || quizData.length === 0) {
                alert('Nie udało się załadować pytań. Spróbuj ponownie.');
                return;
            }

            currentQuestionIndex = 0;
            const currentQuestion = quizData[currentQuestionIndex];

            // Załaduj opisy pytania
            if (questionDescriptionCookie === "local_question_description") {
                await loadQuestionDescriptionFromLocal();
            } else if (questionDescriptionCookie === "api_question_description") {
                await loadQuestionDescriptionFromAPI(currentQuestion);
            }

            displayQuestion(currentQuestion, introductionData, quizDataCookie);
        } catch (error) {
            alert('Błąd podczas ładowania pytań. Spróbuj ponownie.');
            console.error(error);
        }
    }

    getQuestionButton.addEventListener('click', async () => {
        if (!selectedCategory) {
            alert('Proszę wybrać kategorię pytań!');
            return;
        }

        await loadAndDisplayNextQuestion();
        getQuestionButton.style.display = 'none';
    });

    // Expose loadAndDisplayNextQuestion globally for use in checkAnswer
    window.loadAndDisplayNextQuestion = loadAndDisplayNextQuestion;
});

function displayQuestion(question, introductionData, quizDataCookie) {
    // Remove previous question if exists
    const existingContainer = document.getElementById('question-container');
    if (existingContainer) existingContainer.remove();

    // Create question container
    const container = document.createElement('div');
    container.id = 'question-container';
    container.className = 'question-container';

    // Create question introduction container
    if (introductionData) {
        const introductionContainer = document.createElement('div');
        introductionContainer.id = 'introduction-question-container';
        introductionContainer.className = 'introduction-container';
        
        const introText = document.createElement('p');
        introText.innerHTML = decodeHTML(introductionData);
        introductionContainer.appendChild(introText);
        
        container.appendChild(introductionContainer);
    }

    // Question text
    const questionText = document.createElement('h3');
    questionText.innerHTML = decodeHTML(question.question);
    container.appendChild(questionText);

    // Combine correct and incorrect answers
    const answers = [...question.incorrect_answers, question.correct_answer];
    answers.sort(() => Math.random() - 0.5);

    // Create answer buttons
    const answersContainer = document.createElement('div');
    answersContainer.className = 'answers-container';
    answers.forEach(answer => {
        const answerBtn = document.createElement('button');
        answerBtn.className = 'answer-btn';
        answerBtn.innerHTML = decodeHTML(answer);
        answerBtn.dataset.answer = answer;
        answerBtn.addEventListener('click', () => {
            document.querySelectorAll('.answer-btn').forEach(btn => btn.classList.remove('selected'));
            answerBtn.classList.add('selected');
        });
        answersContainer.appendChild(answerBtn);
    });
    container.appendChild(answersContainer);

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.id = 'check-answer-btn';
    checkBtn.textContent = 'Sprawdź';
    checkBtn.addEventListener('click', () => checkAnswer(question, quizDataCookie));
    container.appendChild(checkBtn);

    // Result message container
    const resultContainer = document.createElement('div');
    resultContainer.id = 'result-container';
    resultContainer.className = 'result-container';
    container.appendChild(resultContainer);

    document.querySelector('.container').appendChild(container);
}

function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function checkAnswer(question, quizDataCookie) {
    const selectedAnswer = document.querySelector('.answer-btn.selected');
    if (!selectedAnswer) {
        alert('Proszę wybrać odpowiedź!');
        return;
    }
    const resultContainer = document.getElementById('result-container');
    const checkBtn = document.getElementById('check-answer-btn');
    
    // Disable all answer buttons
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.answer === question.correct_answer) {
            btn.classList.add('correct');
        }
    });

    if (selectedAnswer.dataset.answer === question.correct_answer) {
        resultContainer.innerHTML = '<p class="correct-message">✓ Poprawna odpowiedź!</p>';
        selectedAnswer.classList.add('correct');

        if (conclusionData) {
            const conclusionContainer = document.createElement('div');
            conclusionContainer.id = 'conclusion-question-container';
            conclusionContainer.className = 'conclusion-container';

            const conclusionText = document.createElement('p');
            conclusionText.innerHTML = decodeHTML(conclusionData);
            conclusionContainer.appendChild(conclusionText);

            resultContainer.appendChild(conclusionContainer);
        }

        const nextBtn = document.createElement('button');
        nextBtn.id = 'next-question-btn';
        nextBtn.textContent = 'Następne pytanie';
        nextBtn.addEventListener('click', async () => {
            await window.loadAndDisplayNextQuestion();
        });
        resultContainer.appendChild(nextBtn);
    } else {
        resultContainer.innerHTML = '<p class="incorrect-message">✗ Błędna odpowiedź!</p>';
        selectedAnswer.classList.add('incorrect');
        
        // Po 2 sekundach resetuj pytanie
        setTimeout(() => {
            resultContainer.innerHTML = '';
            document.querySelectorAll('.answer-btn').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('selected', 'correct', 'incorrect');
            });
            checkBtn.style.display = 'block';
        }, 2000);
    }
    
    checkBtn.style.display = 'none';
}