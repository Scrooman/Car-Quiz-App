document.addEventListener('DOMContentLoaded', () => {
    const quizApiContainer = document.getElementById('quiz-api-providers-buttons'); // było 'quiz-api-container'
    const aiApiContainer = document.getElementById('ai-api-providers-buttons');     // było 'ai-api-container'
    const startButton = document.getElementById('start-button');

    // Delete previous session storage items
    sessionStorage.removeItem('selectedQuizApi');
    sessionStorage.removeItem('selectedAiApi');
    cookieStore.delete('selectedQuizApi');
    cookieStore.delete('selectedAiApi');

    window.addEventListener('pageshow', async (event) => {
        // Wyloguj użytkownika za każdym razem, gdy strona główna jest pokazywana (w tym po cofnięciu)
        cookieStore.delete('selectedQuizApi');
        cookieStore.delete('selectedAiApi');
        console.log('isLoggedIn on pageshow:', isLoggedIn);
        console.log('currentTeamName on pageshow:', currentTeamName);
        const teamIdCookie = await cookieStore.get('teamId');
        if (teamIdCookie) {
            console.log('teamId from Cookie Store:', teamIdCookie.value);
            isLoggedIn = true;
            
            const teamNameCookie = await cookieStore.get('teamName');
            currentTeamName = teamNameCookie ? teamNameCookie.value : null;
            currentTeamId = teamIdCookie.value;
        }

        // przeładuj stronę ale tylko raz
        if (event.persisted) {
            location.reload();
        }
        if (isLoggedIn && currentTeamName === "guest") {
            handleLogout();
        }
        if (currentTeamName && currentTeamName != "guest") {
            showLoggedInState();
            const playButton = document.getElementById('play-button');
            console.log('Showing Play Button for logged in user');
            playButton.style.display = 'block';
            const startButton = document.getElementById('start-button');
            startButton.style.display = 'none';
        }


    // Obsługa zdarzeń dla przycisku playButton
    const playButton = document.getElementById('play-button');

    playButton.addEventListener('click', async () => {
        if (!selectedQuizApi) {
            showMessage('Please select a Quiz API before starting the game', 'error');
            return;
        }
        if (!selectedAiApi) {
            showMessage('Please select an AI API before starting the game', 'error');
            return;
        }
        window.location.href = '/game';
    });

    });

    // Auth elements
    const teamNameInput = document.getElementById('team-name');
    const teamPasswordInput = document.getElementById('team-password');
    const repeatPasswordLabel = document.getElementById('repeat-password-label');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const authContainer = document.getElementById('auth-container');

    let isLoggedIn = false;
    let currentTeamName = null;
    let currentTeamId = null;


    let selectedQuizApi = null;
    let selectedAiApi = null;

    // Sprawdź czy użytkownik jest zalogowany
    checkLoginStatus();

    // Fetch local API providers from JSON file
    fetch('/static/data/local_api_providers.json')
        .then(response => response.json())
        .then(data => {
            populateApiButtons(data.quiz_api, quizApiContainer, 'quiz');
            populateApiButtons(data.ai_api, aiApiContainer, 'ai');
        })
        .catch(error => console.error('Error fetching API providers:', error));

    // Funkcja do haszowania hasła (SHA-256)
    function hashPassword(password) {
        return CryptoJS.SHA256(password).toString();
    }

    // === AUTH FUNCTIONALITY ===
    
    async function checkLoginStatus() {
        try {
            const response = await fetch('/api/auth/current-user', {
                method: 'GET',
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.logged_in) {
                    isLoggedIn = true;
                    currentTeamName = data.team_name;
                    cookieStore.set('teamName', currentTeamName);
                    console.log('Current Team Name set in Cookie Store:', currentTeamName);
                    currentTeamId = data.team_id;
                    cookieStore.set('teamId', currentTeamId);
                    console.log('Current Team ID set in Cookie Store:', currentTeamId);
                    showLoggedInState();
                }
            }
        } catch (error) {
            console.error('Error checking login status:', error);
        }
    }

    function showLoggedInState() {
        // Ukryj formularz logowania

        if (currentTeamName != "guest") {
            authContainer.style.display = 'block';
        
            authContainer.innerHTML = `
                <div class="container-title">Welcome, ${currentTeamName}!</div>
                <div id="auth-inner-container" style="display: flex; flex-direction: column; align-items: center;">
                    <table id="team-stats-table">
                        <thead>

                        </thead>
                        <tbody id="team-stats-tbody"></tbody>
                    </table>
                    <button class="auth-button" id="logout-button" style="background-color: #e74c3c; margin-top: 1rem;">Log Out</button>
                </div>
            `;

            let teamStats = localStorage.getItem('teamStats') ? JSON.parse(localStorage.getItem('teamStats')) : null;
            const tbody = document.getElementById('team-stats-tbody');
            
            if (tbody && teamStats) {
                const statsData = [
                    { name: 'Total Points', value: `${teamStats.total_points || 0} pts` },
                    { name: 'Questions Answered', value: teamStats.questions_answered || 0 },
                    { name: 'Correct Answers', value: teamStats.correct_answers || 0 },
                    { name: 'Incorrect Answers', value: teamStats.incorrect_answers || 0 },
                    { name: 'Accuracy', value: `${(teamStats.accuracy_percentage || 0).toFixed(1)}%` },
                    { name: 'Current Streak', value: teamStats.current_streak || 0 },
                    { name: 'Best Streak', value: teamStats.best_streak || 0 }
                ];

                statsData.forEach(stat => {
                    const row = tbody.insertRow();
                    row.innerHTML = `<td>${stat.name}</td><td>${stat.value}</td>`;
                });
            }

            // Dodaj obsługę wylogowania
            document.getElementById('logout-button').addEventListener('click', handleLogout);
            // usuń pole h3-guest-play-info
            const h3GuestPlayInfo = document.getElementById('h3-guest-play-info');
            if (h3GuestPlayInfo) {
                h3GuestPlayInfo.style.display = 'none';
            }
            // przestań wyświetlać przycisk playButton dla gościa
            const playButton = document.getElementById('play-button-guest');
            if (playButton) {
                playButton.style.display = 'none';
            }

            // przestań wyświetlać info o stats
            const h3StatsInfo = document.getElementById('h3-stats-info');
            if (h3StatsInfo) {
                h3StatsInfo.style.display = 'none';
            }
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin'
            });

            if (response.ok) {
                isLoggedIn = false;
                currentTeamName = null;

                // Usuń dane zespołu z localStorage i cookieStore
                localStorage.removeItem('teamStats');
                cookieStore.delete('teamName');
                cookieStore.delete('teamId');
                

                location.reload();

                // location.reload(); // Przeładuj stronę
            }
        } catch (error) {
            console.error('Error logging out:', error);
            showMessage('Error logging out. Please try again.', 'error');
        }
    }

    async function loginTeam(teamName, password) {
        if (!teamName || !password) {
            showMessage('Please enter team name and password', 'error');
            return { success: false, error: 'Missing credentials' };
        }

        try {
            // ✅ Zahaszuj hasło przed wysłaniem
            const hashedPassword = hashPassword(password);
        
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    team_name: teamName,
                    password: hashedPassword
                }),
                credentials: 'same-origin'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('Login successful! Welcome back!', 'success');
                isLoggedIn = true;
                currentTeamName = teamName;
                cookieStore.set('teamName', currentTeamName);
                console.log('Current Team Name set in Cookie Store:', currentTeamName);
                currentTeamId = data.result.team_id;
                cookieStore.set('teamId', currentTeamId);
                console.log('Current Team ID set in Cookie Store:', currentTeamId);
                console.log('Team Data received on login:', data);
                // zapisz statystyki zaspołu w localStorage
                localStorage.setItem('teamStats', JSON.stringify(data.result.team_data.stats));
                console.log('Team Stats set in localStorage:', data.result.team_data.stats);

                setTimeout(() => {
                    showLoggedInState();
                }, 1000);
                if (currentTeamName != "guest") {
                    const playButton = document.getElementById('play-button');
                    playButton.style.display = 'block';
                }



                return { success: true, team_name: teamName, team_id: data.team_id };
            } else {
                showMessage(data.error || 'Login failed', 'error');
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Error during login:', error);
            showMessage('An error occurred. Please try again.', 'error');
            return { success: false, error: 'Network error' };
        }
    }

    // Obsługa zdarzeń dla przycisków logowania
    loginButton.addEventListener('click', async () => {
        await loginTeam(teamNameInput.value.trim(), teamPasswordInput.value);
    });


    async function registerTeam(teamName, password, repeatPassword) {
        try {
            // ✅ Zahaszuj hasła przed wysłaniem
            const hashedPassword = hashPassword(password);
            const hashedRepeatPassword = hashPassword(repeatPassword);
        
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    team_name: teamName,
                    password: hashedPassword,
                    repeat_password: hashedRepeatPassword
                }),
                credentials: 'same-origin'
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error during registration:', error);
            return { success: false, error: 'Network error' };
        }
    }

    registerButton.addEventListener('click', async () => {
        const teamName = teamNameInput.value.trim();
        const password = teamPasswordInput.value;

        // Sprawdź czy pokazać pole repeat password
        if (!repeatPasswordLabel.style.display || repeatPasswordLabel.style.display === 'none') {
            // Pokaż pole repeat password
            repeatPasswordLabel.style.display = 'block';
            
            // Utwórz pole repeat password jeśli nie istnieje
            let repeatPasswordInput = document.getElementById('repeat-password-input');
            if (!repeatPasswordInput) {
                repeatPasswordInput = document.createElement('input');
                repeatPasswordInput.className = 'auth-input';
                repeatPasswordInput.type = 'password';
                repeatPasswordInput.id = 'repeat-password-input';
                repeatPasswordInput.placeholder = 'Repeat your password';
                let repeatPasswordLabelGroup = document.getElementById('repeat-password-group');
                repeatPasswordLabelGroup.appendChild(repeatPasswordInput);
            }
            
            registerButton.textContent = 'Sign In';
            loginButton.disabled = true;
            loginButton.style.pointerEvents = 'none';
            loginButton.style.opacity = '0.5';
            return;
        }

        // Walidacja
        if (!teamName || !password) {
            showMessage('Please enter team name and password', 'error');
            return;
        }

        if (teamName.length < 3) {
            showMessage('Team name must be at least 3 characters', 'error');
            return;
        }

        if (password.length < 8) {
            showMessage('Password must be at least 8 characters', 'error');
            return;
        }

        const repeatPassword = document.getElementById('repeat-password-input').value;
        if (password !== repeatPassword) {
            showMessage('Passwords do not match', 'error');
            return;
        }

        try {
            registerTeam(teamName, password, repeatPassword).then(async (data) => {
                if (data.success) {
                    showMessage('Registration successful! You are now logged in!', 'success');
                    isLoggedIn = true;
                    currentTeamName = teamName;
                    currentTeamId = data.result.team_id;
                    cookieStore.set('teamName', currentTeamName);
                    console.log('Current Team Name set in Cookie Store:', currentTeamName);
                    currentTeamId = data.result.team_id;
                    cookieStore.set('teamId', currentTeamId);
                    console.log('Current Team ID set in Cookie Store:', currentTeamId);
                    console.log('Team Data received on login:', data);
                    // zapisz statystyki zaspołu w localStorage
                    localStorage.setItem('teamStats', JSON.stringify(data.result.team_data.stats));
                    console.log('Team Stats set in localStorage:', data.result.team_data.stats);

                    // Poczekaj chwilę i odśwież interfejs
                    setTimeout(() => {
                        showLoggedInState();
                    }, 1000);

                    const playButton = document.getElementById('play-button');
                    playButton.style.display = 'block';
                } else {
                    showMessage(data.error || 'Registration failed', 'error');
                    // Zresetuj przycisk register
                    resetRegisterButton();
                }
            });
        } catch (error) {
            console.error('Error during registration:', error);
            showMessage('An error occurred. Please try again.', 'error');
            // Zresetuj przycisk register
            resetRegisterButton();
        }
    });

    function resetRegisterButton() {
        repeatPasswordLabel.style.display = 'none';
        const repeatPasswordInput = document.getElementById('repeat-password');
        if (repeatPasswordInput) {
            repeatPasswordInput.remove();
        }
        registerButton.textContent = 'Register';
        loginButton.disabled = false;
        loginButton.style.opacity = '1';


    }

    function showMessage(message, type = 'info') {
        // Usuń poprzednie wiadomości
        const existingMessage = document.querySelector('.auth-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Utwórz nową wiadomość
        const messageDiv = document.createElement('div');
        messageDiv.className = `auth-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
            ${type === 'error' ? 'background-color: #e74c3c; color: white;' : ''}
            ${type === 'success' ? 'background-color: #2ecc71; color: white;' : ''}
            ${type === 'info' ? 'background-color: #3498db; color: white;' : ''}
        `;

        const authInnerContainer = document.getElementById('auth-inner-container');
        if (authInnerContainer) {
            authInnerContainer.insertBefore(messageDiv, authInnerContainer.firstChild);

            // Usuń wiadomość po 5 sekundach
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
    }
    

    function populateApiButtons(apiList, container, type) {
        apiList.forEach(api => {
            const button = document.createElement('button');
            button.textContent = api.name;
            button.classList.add('quiz-api-providers-button');
            
            button.addEventListener('click', () => {
                if (type === 'quiz') {
                    selectedQuizApi = api.name;
                    console.log(`Selected Quiz API: ${api.name}`);
                    cookieStore.set('selectedQuizApi', api.name);
                    cookieStore.get('selectedQuizApi').then(cookie => {
                        console.log('Cookie Store Quiz API:', cookie ? cookie.value : null);
                    });
                } else {
                    selectedAiApi = api.name;
                    console.log(`Selected AI API: ${api.name}`);
                    cookieStore.set('selectedAiApi', api.name);
                    cookieStore.get('selectedAiApi').then(cookie => {
                        console.log('Cookie Store AI API:', cookie ? cookie.value : null);
                    });
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
        // Sprawdź czy użytkownik jest zalogowany
        if (!selectedQuizApi) {
            showMessage('Please select a Quiz API before starting the game', 'error');
            return;
        }
        if (!selectedAiApi) {
            showMessage('Please select an AI API before starting the game', 'error');
            return;
        }
        // wyświetl info o statystykach zespołu, jesli masz konto
        const h3StatsInfo = document.getElementById('h3-stats-info');
        h3StatsInfo.style.display = 'block';
        h3StatsInfo.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });

        if (!isLoggedIn) {
            const startButton = document.getElementById('start-button');
            startButton.style.display = 'none'; // Ukryj przycisk START!
            const container = document.getElementById('main-container');
            console.log('Current container elements:', container);
            // Show two buttons: Log In and Play as Guest
            const buttonsContainer = document.createElement('div');
            buttonsContainer.id = 'login-in-decision-buttons';
            container.appendChild(buttonsContainer);
            const goToLoginButton = document.createElement('button');
            goToLoginButton.className = 'start-button';
            goToLoginButton.textContent = 'Log In';
            goToLoginButton.addEventListener('click', () => {
                // wyświetl formularz logowania
                const authContainer = document.getElementById('auth-container');
                authContainer.style.display = 'block';
                // wyświetl info o statystykach zespołu, jesli masz konto
                const h3GuestPlayInfo = document.getElementById('h3-guest-play-info');
                h3GuestPlayInfo.style.display = 'block';


                // ukryj przycisk logowania
                goToLoginButton.style.display = 'none';
                // Przewiń do kontenera pytania
                authContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            });

            const guestButton = document.createElement('button');
            guestButton.className = 'start-button';
            guestButton.textContent = 'Play as Guest';
            guestButton.id = 'play-button-guest';
            guestButton.addEventListener('click', async () => {
                console.log('Logging in as guest...');
                if (isLoggedIn) {
                    showMessage('You are already logged in', 'info');
                } else {
                    showMessage('Logging in as guest...', 'info');
                    // Log in as guest
                    await loginTeam("guest", "guestpassword");
                    // Start game as guest
                    showMessage('You are now playing as a guest', 'success');
                }
                setTimeout(() => {
                    window.location.href = '/game';
                }, 1000);
                
            });

            // Append buttons to container
            buttonsContainer.appendChild(guestButton);
            buttonsContainer.appendChild(goToLoginButton);

            return;
        }

        if (selectedQuizApi && selectedAiApi) {
            // sessionStorage.setItem('selectedQuizApi', selectedQuizApi);
            // sessionStorage.setItem('selectedAiApi', selectedAiApi);
            window.location.href = '/game';
        } else {
            showMessage('Please select both a Quiz API and an AI API before starting the game', 'error');

        }
    });
});