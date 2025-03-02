document.addEventListener("DOMContentLoaded", function () {
  let db;
  const dbName = "WordLearnerDB";
  const storeName = "Words";

  let currentWordIndex = 0;
  let wordsList = [];
  let wordsDue = [];

  let questionsAsked = 0;
  let questionsUnderstood = 0;

  // Open or create the database
  const request = indexedDB.open(dbName, 1);

  request.onupgradeneeded = function (event) {
    db = event.target.result;

    // Create the Words object store if it doesn't exist
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: "word" });
    }
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    //loadWords();
    loadPracticeWords();
	
	//fix empty voices in chrome
	speechSynthesis.getVoices()
  };

  request.onerror = function (event) {
    console.error("Error opening database:", event.target.error);
  };

  // Open modal for adding or editing a word
  document
    .getElementById("add-word-btn")
    .addEventListener("click", function () {
      // Clear the form and set the modal title for adding
      document.getElementById("word-form").reset();
      document.getElementById("word-modal-label").textContent = "Add New Word";
      document.getElementById("original-word").value = ""; // Clear hidden field
    });

  // Load words into the table
  function loadWords() {
    document.getElementById("words-loading").style.display = "block";
    document.getElementById("words-notfound").style.display = "none";
    document.querySelector("#word-table tbody").innerHTML = "";
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = function () {
      document.getElementById("words-loading").style.display = "none";
      const today = new Date().toISOString().split("T")[0];
      const words = request.result;
      const tbody = document.querySelector("#word-table tbody");
      tbody.innerHTML = "";
      if (words.length === 0) {
        document.getElementById("words-notfound").style.display = "block";
      } else {
        document.getElementById("words-notfound").style.display = "none";
      }
      words.forEach((word) => {
        const lastReviewed = new Date(word.lastReviewed);
        const daysSinceReview = Math.floor(
          (new Date(today) - lastReviewed) / (1000 * 60 * 60 * 24)
        );
        tbody.innerHTML += `
          <tr>
            <td>${word.word}</td>
            <td>${word.sentence}</td>
            <td>${word.box || 0}${
          word.box == 1 ? "." + word.daysInBox1 : ""
        }</td>
            <td>${daysSinceReview || 0}</td>
            <td>
              <button class="btn btn-sm btn-warning edit-word" data-word="${
                word.word
              }" data-sentence="${word.sentence}">Edit</button>
              <button class="btn btn-sm btn-danger delete-word" data-word="${
                word.word
              }">Delete</button>
            </td>
          </tr>
        `;
      });
    };
  }

  document.addEventListener("click", function (event) {
    if (event.target.classList.contains("delete-word")) {
      const word = event.target.getAttribute("data-word");
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      store.delete(word);

      transaction.oncomplete = function () {
        showAlert("Word deleted successfully!", "success");
        loadWords();
        loadPracticeWords();
      };
    }

    if (event.target.classList.contains("edit-word")) {
      // Populate the form with the word data for editing
      const word = event.target.getAttribute("data-word");
      const sentence = event.target.getAttribute("data-sentence");

      document.getElementById("modal-word").value = word;
      document.getElementById("modal-sentence").value = sentence;
      document.getElementById("original-word").value = word; // Store the original word for editing
      document.getElementById("word-modal-label").textContent = "Edit Word";

      // Show the modal
      const wordModal = new bootstrap.Modal(
        document.getElementById("word-modal")
      );
      wordModal.show();
    }
  });

  // Open modal for adding or editing a word
  document
    .getElementById("add-word-btn")
    .addEventListener("click", function () {
      // Clear the form and set the modal title for adding
      document.getElementById("word-form").reset();
      document.getElementById("word-modal-label").textContent = "Add New Word";
      document.getElementById("original-word").value = ""; // Clear hidden field
    });

  // Handle form submission for adding or editing a word
  document
    .getElementById("word-form")
    .addEventListener("submit", function (event) {
      event.preventDefault(); // Prevent form submission

      const originalWord = document.getElementById("original-word").value;
      const newWord = document.getElementById("modal-word").value.trim();
      const newSentence = document
        .getElementById("modal-sentence")
        .value.trim();

      if (!newWord || !newSentence) {
        showAlert("Please enter both a word and a sentence.", "warning");
        return;
      }

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      if (originalWord) {
        // Editing an existing word
        store.delete(originalWord); // Delete the old word
      }

      // Add the new/updated word
      store.put({ word: newWord, sentence: newSentence });

      transaction.oncomplete = function () {
        showAlert(
          originalWord
            ? "Word updated successfully!"
            : "Word added successfully!",
          "success"
        );
        loadWords(); // Refresh the word list
        loadPracticeWords(); // Refresh the practice words

        // Hide the modal
        const wordModal = bootstrap.Modal.getInstance(
          document.getElementById("word-modal")
        );
        wordModal.hide();
      };

      transaction.onerror = function () {
        console.error("Error saving word:", transaction.error);
        showAlert("Failed to save word.", "error");
      };
    });

  // Rebuild database
  document
    .getElementById("rebuild-db-btn")
    .addEventListener("click", function () {
      indexedDB.deleteDatabase(dbName);
      showAlert("Database rebuilt. Refresh the page.", "info");
      location.reload();
    });

  // Export data
  document
    .getElementById("export-data-btn")
    .addEventListener("click", function () {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = function () {
        const words = request.result;
        const blob = new Blob([JSON.stringify(words, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "word-data.json";
        a.click();
        // Clean up
        URL.revokeObjectURL(url);
      };

      request.onerror = function () {
        showAlert("Failed to export data.", "danger");
      };
    });

  // Export words
  document
    .getElementById("export-words-btn")
    .addEventListener("click", function () {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = function () {
        const words = request.result;
        // Extract only word and sentence columns
        const data = words.map(({ word, sentence }) => ({ word, sentence }));

        // Create a JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "words.json";
        a.click();
        // Clean up
        URL.revokeObjectURL(url);
      };

      request.onerror = function () {
        showAlert("Failed to export words.", "danger");
      };
    });

  // Load words for practice
  function loadPracticeWords() {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = function () {
      wordsList = request.result;
      wordsDue = getWordsDueForReview(wordsList);
      if (wordsDue.length === 0) {
        document.getElementById("understand-btn").style.display = "none";
        document.getElementById("dont-understand-btn").style.display = "none";
        document.getElementById("start-btn").style.display = "none";
        document.getElementById("progress-section").style.display = "none";
        document.getElementById("sentence").textContent =
          "No words to practice today.";
      } else {
        document.getElementById("understand-btn").style.display = "none";
        document.getElementById("dont-understand-btn").style.display = "none";
        document.getElementById("start-btn").style.display = "";
        document.getElementById("progress-section").style.display = "none";
        document.getElementById(
          "sentence"
        ).innerHTML = `Today, your goal is to learn <strong>${wordsDue.length}</strong> new words.<br>Take your time to understand their meanings, practice using them in sentences. you're making progress every day!`;
      }
    };
  }

  // Function to show an inline alert
  function showAlert(message, type = "success") {
    const alertContainer = document.getElementById("alert-container");
    const alert = document.createElement("div");
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = "alert";
    alert.innerHTML = `
		${message}
		<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
	  `;

    alertContainer.appendChild(alert);

    // Automatically remove the alert after 5 seconds
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  // Import words from a file
  document.getElementById("import-btn").addEventListener("click", function () {
    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];

    if (!file) {
      showAlert("Please select a file to import.", "warning");
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      try {
        const words = JSON.parse(event.target.result);

        if (!Array.isArray(words)) {
          throw new Error("Invalid file format. Expected an array of words.");
        }

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);

        words.forEach((word) => {
          if (!word.word || !word.sentence) {
            throw new Error(
              "Invalid word format. Each word must have a 'word' and 'sentence' property."
            );
          }
          store.put(word);
        });

        transaction.oncomplete = function () {
          showAlert("Words imported successfully!", "success");
          loadWords();
          loadPracticeWords();
        };

        transaction.onerror = function () {
          showAlert("Failed to import words.", "danger");
        };
      } catch (error) {
        showAlert(error.message, "danger");
      }
    };

    reader.onerror = function () {
      showAlert("Failed to read the file.", "danger");
    };

    reader.readAsText(file);
  });

  // Function to move a word back to Box 1
  function moveToBox1(word) {
    word.box = 1; // Move back to Box 1
    word.daysInBox1 = 0; // Reset days in Box 1
    word.lastReviewed = new Date().toISOString().split("T")[0]; // Update last reviewed date
  }

  // Function to move a word to Box 2 after 7 days in Box 1
  function moveToNextBox(word) {
    if (typeof word.box === "undefined") {
      word.box = 1; // Move to Box 1
      word.daysInBox1 = 1; // Set days in Box 1
    } else if (word.box === 1) {
      word.daysInBox1 += 1; // Increment days in Box 1
      if (word.daysInBox1 >= 7) {
        word.box = 2; // Move to Box 2 after 7 days
        word.daysInBox1 = 0; // Reset days in Box 1
      }
    } else if (word.box < 5) {
      word.box += 1;
    }
    word.lastReviewed = new Date().toISOString().split("T")[0]; // Update last reviewed date
  }

  // Function to get words due for review
  function getWordsDueForReview(words) {
    showVoiceControl(loadIsSpeechActive());
    const settings = loadSettings();
    const today = new Date().toISOString().split("T")[0];
    newCount = 0;
    return words.filter((word) => {
      const lastReviewed = new Date(word.lastReviewed);
      const daysSinceReview = Math.floor(
        (new Date(today) - lastReviewed) / (1000 * 60 * 60 * 24)
      );

      if (
        newCount < settings.newWordsPerDay &&
        (typeof word.box === "undefined" ||
          (word.box === 1 && word.daysInBox1 === 0 && daysSinceReview >= 1))
      ) {
        newCount++;
        return true;
      } else if (word.box === 1) {
        return daysSinceReview >= 1; // Review Box 1 words daily
      } else if (word.box < 5) {
        const reviewInterval = Math.pow(2, word.box - 1); // Box 1: 1 day, Box 2: 2 days, etc.
        return daysSinceReview >= reviewInterval; // Review Box 2 words every 3 days
      }
      return false;
    });
  }

  function speak(sentence) {
    // create a new speech
    let speech = new SpeechSynthesisUtterance();

    // specify the sentence to speak out loud
    speech.text = sentence;
    voice = speechSynthesis.getVoices().filter(function (voice) {
      return voice.name == "Google US English";
    })[0];
    if (voice) speech.voice = voice;
    // the optional settings
    speech.lang = "en-US";
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    // speak it!
    window.speechSynthesis.speak(speech);
  }

  function showNextWord() {
    if (wordsDue.length === 0) {
      document.getElementById("understand-btn").style.display = "none";
      document.getElementById("dont-understand-btn").style.display = "none";
      document.getElementById("start-btn").style.display = "";
      document.getElementById("sentence").textContent =
        "No words to practice today.";
      return;
    } else if (currentWordIndex >= wordsDue.length) {
      showAlert(
        "Congratulations! You have completed all the words for today.",
        "success"
      );
      document.getElementById("understand-btn").style.display = "none";
      document.getElementById("dont-understand-btn").style.display = "none";
      document.getElementById("start-btn").style.display = "";
      document.getElementById("sentence").textContent =
        "Congratulations! You have completed all the words for today.";
      updateRemainingQuestions();
      updateProgress();
      return;
    }
    const word = wordsDue[currentWordIndex];

    // Remove the final 'e' if it exists
    const baseWord =
      word.word.endsWith("e") || word.word.endsWith("y")
        ? word.word.slice(0, -1)
        : word.word;
    const box =
      typeof word.box == "undefined"
        ? "0"
        : word.box == "1"
        ? word.box + "." + word.daysInBox1
        : word.box;
    const sentence = word.sentence.replace(
      new RegExp(`\\b${baseWord}(es|ed|ing|ies|ied|ted|e|y|s|d)?`, "gi"),
      `<strong>$&</strong>`
    );
    document.getElementById("sentence").innerHTML =
      `<strong>${word.word}</strong><br>` +
      sentence +
      `<span id="box">Box ${box}</span>`;
    updateRemainingQuestions();
    updateProgress();
    if (loadIsSpeechActive())
      setTimeout(function () {
        speak(word.sentence);
      }, 100);
  }

  document
    .getElementById("understand-btn")
    .addEventListener("click", function () {
      const word = wordsDue[currentWordIndex];
      moveToNextBox(word); // Update word box
      storeAnswer(word);
      currentWordIndex = currentWordIndex + 1;
      questionsAsked = questionsAsked + 1;
      questionsUnderstood = questionsUnderstood + 1;
      showNextWord();
    });

  document
    .getElementById("dont-understand-btn")
    .addEventListener("click", function () {
      const word = wordsDue[currentWordIndex];
      moveToBox1(word); // move back to Box 1
      storeAnswer(word);
      currentWordIndex = currentWordIndex + 1;
      questionsAsked = questionsAsked + 1;
      showNextWord();
    });

  document.getElementById("start-btn").addEventListener("click", function () {
    document.getElementById("understand-btn").style.display = "";
    document.getElementById("dont-understand-btn").style.display = "";
    document.getElementById("start-btn").style.display = "none";
    document.getElementById("progress-section").style.display = "";
    showNextWord();
  });

  // save client answer
  function storeAnswer(word) {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // fetch current word
    const wordRequest = store.get(word.word);

    wordRequest.onsuccess = () => {
      //const wordData = wordRequest.result;
      store.put(word); // store word
    };
  }

  // Save settings to localStorage
  function saveSettings(newWordsPerDay) {
    localStorage.setItem("settings", JSON.stringify({ newWordsPerDay }));
    showAlert("Settings saved successfully!", "success");
  }
  // Load settings from localStorage
  function loadSettings() {
    const settings = JSON.parse(localStorage.getItem("settings")) || {
      newWordsPerDay: 10,
    }; // Default value
    document.getElementById("new-words-per-day").value =
      settings.newWordsPerDay;
    return settings;
  }
  // Handle settings form submission
  document
    .getElementById("settings-form")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const newWordsPerDay = parseInt(
        document.getElementById("new-words-per-day").value,
        10
      );
      saveSettings(newWordsPerDay);
    });

  // Manage section display
  function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll(".section").forEach((section) => {
      section.classList.remove("active");
    });
    // Show the selected section
    document.getElementById(sectionId).classList.add("active");

    // Check if the active section is the "Words" section
    if (sectionId === "words") {
      loadWords(); // Load words when the "Words" section becomes active
    }
  }

  // Manage menu
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const sectionId = link.getAttribute("data-section");
      showSection(sectionId);
      // Activate the selected link
      document.querySelectorAll(".nav-link").forEach((navLink) => {
        navLink.classList.remove("active");
      });
      link.classList.add("active");
    });
  });

  // Update the number of remaining questions
  function updateRemainingQuestions() {
    const remainingQuestions = wordsDue.length - currentWordIndex;
    document.getElementById("remainingQuestions").textContent =
      remainingQuestions;
  }

  // Update progress
  function updateProgress() {
    if (wordsDue.length > 0 && questionsAsked > 0) {
      const progressPercentage = (
        (questionsUnderstood / questionsAsked) *
        100
      ).toFixed(2);
      document.getElementById(
        "progressPercentage"
      ).textContent = `${progressPercentage}%`;
    } else {
      document.getElementById("progressPercentage").textContent = "0%";
    }
  }

  //
  function showVoiceControl(isSpeechActive) {
    document.getElementById("voice-control").style.display = "inline-block";
    if (isSpeechActive) {
      document.getElementById("voice-control").classList.add("active");
    } else {
      document.getElementById("voice-control").classList.remove("active");
    }
  }
  // Save isSpeechActive to localStorage
  function saveIsSpeechActive(isSpeechActive) {
    localStorage.setItem("isSpeechActive", isSpeechActive);
  }
  // Load isSpeechActive from localStorage
  function loadIsSpeechActive() {
    isSpeechActive = localStorage.getItem("isSpeechActive") || "true";
    return isSpeechActive === "true"; // Default value
  }
  // Add event listener to the voice control icon
  document
    .getElementById("voice-control")
    .addEventListener("click", function () {
      isSpeechActive = !loadIsSpeechActive();
      saveIsSpeechActive(isSpeechActive);
      showVoiceControl(isSpeechActive);
    });

  loadSettings();
});
