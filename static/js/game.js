let quizCategories = [];
let quizData = [];
let selectedCategory = null;
let currentQuestionIndex = 0;
let introductionData = '';
let conclusionData = '';
let keywordsData = [];

let currentTeamName = getCookie('teamName');
let currentTeamId = getCookie('teamId');

let teamStats = localStorage.getItem('teamStats') ? JSON.parse(localStorage.getItem('teamStats')) : null;

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

function addDelayedClick(element, callback, delay = 200) {
    element.addEventListener('click', (e) => {
        setTimeout(() => callback(e), delay);
    });
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
    const selectedQuizApi = getCookie('selectedQuizApi');
    const selectedAiApi = getCookie('selectedAiApi');
    quizAPIContainer.textContent = selectedQuizApi ? `${selectedQuizApi}` : 'No Quiz API selected.';
    aiAPIContainer.textContent = selectedAiApi ? `${selectedAiApi}` : 'No AI API selected.';

    // wyświetl dane w user-info-tab
    const teamNameDisplay = document.getElementById('team-name-display');
    if (teamNameDisplay) {
        const teamNameLabel = document.createElement('p');
        teamNameLabel.style.fontWeight = '400';
        teamNameDisplay.appendChild(teamNameLabel);
        correctedName = currentTeamName === 'guest' ? 'Guest' : currentTeamName;
        teamNameLabel.textContent = `${correctedName ? correctedName : 'Guest'}`;
    }
    const teamScoreDisplay = document.getElementById('team-score-display');
    if (teamScoreDisplay) {
        const teamScoreLabel = document.createElement('p');
        teamScoreLabel.style.fontWeight = '400';
        teamScoreDisplay.appendChild(teamScoreLabel);
        teamScoreLabel.textContent = `${teamStats ? teamStats.total_points : 0} pts`;
    }
    const teamAnsweredQuestionsDisplay = document.getElementById('team-answered-questions-display');
    if (teamAnsweredQuestionsDisplay) {
        const teamAnsweredQuestionsLabel = document.createElement('p');
        teamAnsweredQuestionsLabel.style.fontWeight = '400';
        teamAnsweredQuestionsDisplay.appendChild(teamAnsweredQuestionsLabel);
        teamAnsweredQuestionsLabel.textContent = `${teamStats ? teamStats.questions_answered : 0}`;
    }

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

    // Temperature slider handler
    const temperatureSlider = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature-value');
    
    if (temperatureSlider && temperatureValue) {
        temperatureSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            let label = '';
            
            if (value <= 0.3) {
                label = `🎯 Precise (${value})`;
            } else if (value <= 0.6) {
                label = `⚖️ Balanced (${value})`;
            } else {
                label = `🎨 Creative (${value})`;
            }
            
            temperatureValue.textContent = label;
        });
        
        // Ustaw początkową wartość
        temperatureSlider.dispatchEvent(new Event('input'));
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
                if (selectedAiApi) {
                    console.log('Loading question description from Gemini API...');

                    // Remove previous question if exists
                    const existingContainer = document.getElementById('introduction-question-container');
                    if (existingContainer) existingContainer.remove();

                    const questionContainer = document.getElementById('question-container');
                    // Create question introduction container
                    const introductionContainer = document.createElement('div');
                    introductionContainer.id = 'introduction-question-container';
                    introductionContainer.className = 'introduction-question-container';
                    questionContainer.appendChild(introductionContainer);

                    // Create container title
                    const containerTitle = document.createElement('div');
                    containerTitle.className = 'container-title';
                    containerTitle.textContent = `Introduction`;
                    introductionContainer.appendChild(containerTitle);

                    // Create question introduction inner container
                    const introductionInnerContainer = document.createElement('div');
                    introductionInnerContainer.className = 'introduction-question-inner-container';
                    introductionContainer.appendChild(introductionInnerContainer);

                    const introText = document.createElement('p');
                    introText.innerHTML = `<span class="spinner"></span>Generating introduction...`;
                    introductionInnerContainer.appendChild(introText);
                    const temperatureValue = document.getElementById('temperature').value;

                    // Pobierz wybrany typ promptu
                    const introductionPromptSelect = document.getElementById('introduction_prompt');
                    const selectedPromptType = introductionPromptSelect ? introductionPromptSelect.value : '';

                    
                    const params = new URLSearchParams({
                        temperature: temperatureValue,
                        category: question.category,
                        introduction_prompt_type: selectedPromptType,  // Dodaj typ promptu
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
                                keywordsData = data.slowa_kluczowe || [];
                                console.log('Loaded API introduction data:', introductionData);
                                console.log('Loaded API conclusion data:', conclusionData);
                                console.log('Loaded API keywords data:', keywordsData);
                                // Odblokuj przycisk sprawdzania odpowiedzi
                                const checkBtn = document.getElementById('check-answer-btn');
                                checkBtn.disabled = false;
                                checkBtn.textContent = 'Check';

                                resolve();
                            } else {
                                reject(new Error('Invalid response from description API'));
                            }
                        })
                        .catch(error => {
                            console.error('Error loading question description from API:', error);
                            reject(error);
                            // przerwij działanie funkcji
                            return;
                        });
                } else {
                    reject(new Error('No AI API selected for question description'));
                }
            } else {
                resolve();
            }
        });
    }

    function loadQuestionsFromAPI() {
        return new Promise((resolve, reject) => {

            // pokaż loading state 
            const getQuestionButton = document.getElementById('get-question-button');
            if (getQuestionButton) {
                getQuestionButton.innerHTML = `<span class="spinner"></span>`;
                getQuestionButton.disabled = true;
            }


            const difficulty = document.getElementById('difficulty').value;
            const type = document.getElementById('type').value;
            const category = selectedCategory ? selectedCategory.id : '';

            let questionData = {
                categoryId: category,
                categoryName: ''
            };

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
                        displayQuestion(quizData[0], category, quizDataCookie);

                        getQuestionButton.style.display = 'none';

                        // Usuń przycisk "Get Question" po załadowaniu pytania
                        const getNextQuestionButton = document.getElementById('next-question-btn');
                        if (getNextQuestionButton) {
                            getNextQuestionButton.remove();
                        }
                        questionData['categoryName'] = data.results[0].category;

                        // zaktulizuj statystyki pytań zespołu
                        updateTeamsQuestionStats(questionData);

                        resolve();
                    } else {
                        reject(new Error('No results from API'));
                    }
                })
                .catch(error => {
                    console.error('Error loading quiz data from API:', error);
                    reject(error);
                    // Przywróć przycisk w przypadku błędu
                    if (getQuestionButton) {
                        getQuestionButton.disabled = false;
                        getQuestionButton.textContent = 'Error';

                        setTimeout(() => {
                            getQuestionButton.textContent = 'Show Items';
                        }, 2000);
                    }
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

    async function loadAndDisplayQuestion() {
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

            displayQuestionDescription(introductionData);
        } catch (error) {
            alert('Błąd podczas ładowania pytań. Spróbuj ponownie.');
            console.error(error);
        }
    }

    addDelayedClick(getQuestionButton, async () => {
        if (!selectedCategory) {
            alert('Proszę wybrać kategorię pytań!');
            return;
        } else if (!selectedQuizApi) {
            alert('Proszę wybrać API quizu!');
            return;
        } else if (!selectedAiApi && questionDescriptionCookie === "api_question_description") {
            alert('Proszę wybrać API AI do opisu pytania!');
            return;
        }
        await loadAndDisplayQuestion();
        getQuestionButton.style.display = 'none';
    });

    // Expose loadAndDisplayQuestion globally for use in checkAnswer
    window.loadAndDisplayQuestion = loadAndDisplayQuestion;
});

function displayQuestion(question, category, quizDataCookie) {
    // Remove previous question if exists
    const existingContainer = document.getElementById('question-container');
    if (existingContainer) existingContainer.remove();

    // Create question container
    const container = document.createElement('div');
    container.id = 'question-container';
    container.className = 'question-container';

    // create container title
    const containerTitle = document.createElement('div');
    containerTitle.className = 'container-title';
    containerTitle.textContent = `Question`;
    container.appendChild(containerTitle);

    // create question inner container
    const questionInnerContainer = document.createElement('div');
    questionInnerContainer.className = 'question-container-inner-container';
    container.appendChild(questionInnerContainer);

    // Question text
    const questionText = document.createElement('h3');
    questionText.innerHTML = decodeHTML(question.question);
    questionInnerContainer.appendChild(questionText);

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
    questionInnerContainer.appendChild(answersContainer);

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.id = 'check-answer-btn';
    checkBtn.className = 'check-answer-btn';
    checkBtn.textContent = 'Sprawdź';
    checkBtn.addEventListener('click', () => {
        setTimeout(() => checkAnswer(question, category, quizDataCookie), 300);
    });

    // Zablokuj przycisk tylko jeśli ładujesz opis z API
    const questionDescriptionCookie = getCookie('question_description');
    if (questionDescriptionCookie === "api_question_description") {
        checkBtn.disabled = true;
        console.log('Check button disabled:', checkBtn.disabled);

        checkBtn.innerHTML = `<span class="spinner"></span>`;
    }

    questionInnerContainer.appendChild(checkBtn);


    // Result message container
    const resultContainer = document.createElement('div');
    resultContainer.id = 'result-container';
    resultContainer.className = 'result-container';
    questionInnerContainer.appendChild(resultContainer);

    document.querySelector('.container').appendChild(container);
    // Przewiń do kontenera pytania
    questionInnerContainer.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
    });
}

function displayQuestionDescription(introductionData) {
    // Remove previous question if exists


    const questionContainer = document.getElementById('question-container');
    const introductionContainer = document.getElementById('introduction-question-container');
    // Create question introduction container
    if (introductionData) {
        const introductionInnerContainer = document.getElementsByClassName('introduction-question-inner-container')[0];
        
        // remove loading state
        introductionInnerContainer.innerHTML = '';

        // Dodaj klasę do animacji rozciągania
        introductionInnerContainer.classList.add('loading');
            

        const introText = document.createElement('p');
        introText.style.margin = '0px';
        // Podkreśl słowa kluczowe
        introText.innerHTML = highlightKeywords(decodeHTML(introductionData), keywordsData);
        introductionInnerContainer.appendChild(introText);

        // Usuń klasę loading i dodaj loaded dla animacji
        setTimeout(() => {
            introductionInnerContainer.classList.remove('loading');
            introductionInnerContainer.classList.add('loaded');
            
            // Przewiń ponownie po załadowaniu treści
            introductionInnerContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end' 
            });
        }, 50);

        // Dodaj event listenery do podkreślonych słów
        const keywordElements = introductionInnerContainer.querySelectorAll('.keyword-highlight');
        keywordElements.forEach(element => {
            element.addEventListener('click', async (e) => {
                const keyword = e.target.dataset.keyword;
                await showKeywordDefinition(keyword);
            });
        });
    }
}

function highlightKeywords(text, keywords) {
    if (!keywords || keywords.length === 0) {
        return text;
    }

    let highlightedText = text;
    
    // Sortuj słowa kluczowe od najdłuższych, aby uniknąć konfliktów
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    
    sortedKeywords.forEach((keyword, index) => {
        // Escape special regex characters
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Znajdź wszystkie wystąpienia słowa (case-insensitive, całe słowo)
        const regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
        
        highlightedText = highlightedText.replace(regex, (match) => {
            return `<span class="keyword-highlight" data-keyword="${keyword}" data-index="${index}">${match}</span>`;
        });
    });
    
    return highlightedText;
}

async function showKeywordDefinition(keyword) {
    console.log('Clicked keyword:', keyword);
    
    // Remove previous keyword definition if exists
    const existingDefinition = document.getElementById('keyword-definition-container');
    if (existingDefinition) {
        existingDefinition.remove();
    }

    const questionContainer = document.getElementById('question-container');

    // Create inner container for padding
    const keywordDefinitionContainer = document.createElement('div');
    keywordDefinitionContainer.id = 'keyword-definition-container';
    keywordDefinitionContainer.className = 'keyword-definition-container';
    questionContainer.appendChild(keywordDefinitionContainer);

    setTimeout(() => {
        // Przewiń do kontenera
        keywordDefinitionContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
        });
    }, 50);

    // Create container title
    const containerTitle = document.createElement('div');
    containerTitle.className = 'container-title';
    containerTitle.textContent = `More about`;
    keywordDefinitionContainer.appendChild(containerTitle);

    // Create keyword definition inner container
    const keywordDefinitionInnerContainer = document.createElement('div');
    keywordDefinitionInnerContainer.id = 'keyword-definition-inner-container';
    keywordDefinitionInnerContainer.className = 'keyword-definition-inner-container';

    // Show loading state
    keywordDefinitionInnerContainer.innerHTML = `<span class="spinner"></span> Generating definitions...`;
    keywordDefinitionContainer.appendChild(keywordDefinitionInnerContainer);

    try {
        // Pobierz treść pytania z kontenera
        const questionText = document.querySelector('.question-container h3');
        const currentQuestion = questionText ? questionText.textContent : '';
        
        // Wywołaj API do pobrania definicji słowa kluczowego
        const temperatureValue = document.getElementById('temperature').value;
        const params = new URLSearchParams({
            keyword: keyword,
            temperature: temperatureValue,
            question: currentQuestion  // Dodaj pytanie do parametrów
        });

        const response = await fetch(`/api/get-keyword-definition?${params.toString()}`);
        const data = await response.json();

        if (data.definition) {
            // Dodaj klasę do animacji rozciągania
            keywordDefinitionInnerContainer.classList.add('loading');
            keywordDefinitionInnerContainer.innerHTML = `
                ${data.definition}
            `;
            // Usuń klasę loading i dodaj loaded dla animacji
            setTimeout(() => {
                keywordDefinitionInnerContainer.classList.remove('loading');
                keywordDefinitionInnerContainer.classList.add('loaded');
                
                // Przewiń ponownie po załadowaniu treści
                keywordDefinitionContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'end' 
                });
            }, 50);
        } else {
            keywordDefinitionInnerContainer.innerHTML = '<p class="error-message">Nie udało się załadować definicji.</p>';
        }
    } catch (error) {
        console.error('Error loading keyword definition:', error);
        keywordDefinitionInnerContainer.innerHTML = '<p class="error-message">Błąd podczas ładowania definicji.</p>';
    }
}

function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function updateTeamsQuestionStats(questionData) {
    fetch('/api/team/stats/question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Team stats for question updated successfully:', data);
            // Zaktualizuj wyświetlanie wyniku zespołu

        } else {
            console.error('Error updating team stats for question:', data.error);
        }
    })
    .catch(error => {
        console.error('Error updating team stats for question:', error);
    });
}

function updateTeamsAnswerStats(answerData) {
    fetch('/api/team/stats/answer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(answerData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status) {
            console.log('Team stats updated successfully:', data);
            // Zaktualizuj wyświetlanie wyniku zespołu

        } else {
            console.error('Error updating team stats:', data.error);
        }
    })
    .catch(error => {
        console.error('Error updating team stats:', error);
    });
}

function checkAnswer(question, category, quizDataCookie) {
    const selectedAnswer = document.querySelector('.answer-btn.selected');
    if (!selectedAnswer) {
        alert('Proszę wybrać odpowiedź!');
        return;
    }
    const resultContainer = document.getElementById('result-container');
    const checkBtn = document.getElementById('check-answer-btn');

    let answerData = {
        is_correct_answer: null,
        category_id: category
    };
    
    // Disable all answer buttons
    document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.answer === question.correct_answer) {
            btn.classList.add('correct');
        }
    });

    // Remove previous keyword definition if exists
    const existingDefinition = document.getElementById('keyword-definition-container');
    if (existingDefinition) {
        existingDefinition.remove();
    }

    // wykonaj akcje dla prawidłowej odpwoiedzi
    if (selectedAnswer.dataset.answer === question.correct_answer) {
        selectedAnswer.classList.add('correct');
        checkBtn.textContent = '✅ Correct!';
        checkBtn.classList.add('disabled');
        checkBtn.disabled = true;
        checkBtn.style.fontWeight = 'bold';

        answerData.is_correct_answer = true;
        console.log('answerData.is_correct_answer:', answerData.is_correct_answer);
    } else {
        selectedAnswer.classList.add('incorrect');
        checkBtn.textContent = '❌ Incorrect! ';
        checkBtn.classList.add('disabled');
        checkBtn.disabled = true;
        checkBtn.style.fontWeight = 'bold';
        answerData.is_correct_answer = false;
        console.log('answerData.is_correct_answer:', answerData.is_correct_answer);
    }

        const questionContainer = document.getElementById('question-container');


    if (conclusionData) {
        // Create question conclusion container
        const conclusionContainer = document.createElement('div');
        conclusionContainer.id = 'conclusion-question-container';
        conclusionContainer.className = 'conclusion-question-container';

        // create container title
        const containerTitle = document.createElement('div');
        containerTitle.className = 'container-title';
        containerTitle.textContent = `Conclusion`;
        conclusionContainer.appendChild(containerTitle);
        
        // Create question conclusion inner container
        const conclusionInnerContainer = document.createElement('div');
        conclusionInnerContainer.className = 'conclusion-question-inner-container';
        conclusionContainer.appendChild(conclusionInnerContainer);

        const conclusionText = document.createElement('p');
        conclusionText.style.margin = '0px';
        // Podkreśl słowa kluczowe w podsumowaniu
        conclusionText.innerHTML = highlightKeywords(decodeHTML(conclusionData), keywordsData);
        conclusionInnerContainer.appendChild(conclusionText);

        questionContainer.appendChild(conclusionContainer);

        // Dodaj event listenery do podkreślonych słów w podsumowaniu
        const keywordElements = conclusionInnerContainer.querySelectorAll('.keyword-highlight');
        keywordElements.forEach(element => {
            element.addEventListener('click', async (e) => {
                const keyword = e.target.dataset.keyword;
                await showKeywordDefinition(keyword);
            });
        });
    }

    const nextBtn = document.createElement('button');
    nextBtn.id = 'next-question-btn';
    nextBtn.className = 'next-question-btn';
    nextBtn.textContent = 'Next question';

    nextBtn.addEventListener('click', async () => {
        setTimeout(async () => {
            const getQuestionButton = document.getElementById('next-question-btn');
            getQuestionButton.innerHTML = `<span class="spinner"></span>`;
            getQuestionButton.disabled = true;

            const existingContainer = document.getElementById('question-container');
            if (existingContainer) existingContainer.remove();
            await window.loadAndDisplayQuestion();
        }, 300);
    });

    const container = document.querySelector('.container');
    container.appendChild(nextBtn);

    // Aktualizuj statystyki zespołu

    updateTeamsAnswerStats(answerData);
    
    

}