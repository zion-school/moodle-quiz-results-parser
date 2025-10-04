/*  Moodle Quiz Results Parser - content.js
 *  
 *  Zion Nursery & Primary School, Kovaipudur
 *  
 *  Date : 24-Sep-2025
 */

class MoodleParser {
  constructor() {
    this.parsedResults = [];
    this.isVisible = false;
    console.log('MoodleParser initialized');
  }

  getTestName() {
    const header = document.querySelector('.page-context-header .page-header-headings h1');
    if (header) {
      return header.textContent.trim();
    }
    return 'Moodle Quiz Results';
  }

  // Parse quiz summary table
  parseQuizSummary() {
    const summaryTable = document.querySelector('.generaltable.quizreviewsummary');
    if (!summaryTable) {
      return null;
    }

    const rows = summaryTable.querySelectorAll('tr');
    const summary = {};

    rows.forEach(row => {
      const th = row.querySelector('th');
      const td = row.querySelector('td');
      
      if (th && td) {
        const key = th.textContent.trim();
        const value = td.textContent.trim();
        
        // Clean up and format key-value pairs
        switch(key) {
          case 'Started on':
            summary.startedOn = value;
            break;
          case 'State':
            summary.state = value;
            break;
          case 'Completed on':
            summary.completedOn = value;
            break;
          case 'Time taken':
            summary.timeTaken = value;
            break;
          case 'Marks':
            summary.marks = value;
            break;
          case 'Grade':
            summary.grade = value;
            break;
        }
      }
    });

    // Extract user information
    const userRow = rows[0];
    if (userRow) {
      const userLink = userRow.querySelector('a');
      if (userLink) {
        summary.userName = userLink.textContent.trim();
      }
    }

    return summary;
  }

  // Debug function to check page content
  debugPageContent() {
    console.log('=== Moodle Parser Debug ===');
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    // Check for common Moodle elements
    const commonSelectors = [
      '.que',
      '.question',
      '#page-mod-quiz-review',
      '.mod-quiz',
      '.path-mod-quiz',
      '[class*="question"]',
      '[class*="que"]',
      '.generaltable.quizreviewsummary'
    ];
    
    commonSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements with selector: ${selector}`);
      if (elements.length > 0) {
        console.log('First element:', elements[0]);
      }
    });
    
    // Check for any quiz-related content
    const bodyText = document.body.innerText.toLowerCase();
    const moodleKeywords = ['quiz', 'question', 'answer', 'correct', 'incorrect', 'grade', 'mark'];
    moodleKeywords.forEach(keyword => {
      if (bodyText.includes(keyword)) {
        console.log(`Found keyword: ${keyword}`);
      }
    });
    
    return commonSelectors.some(selector => document.querySelectorAll(selector).length > 0);
  }

  // Enhanced question detection with fallback methods
  findQuestions() {
    console.log('Looking for questions...');
    
    // Primary selectors for different Moodle versions
    const selectors = [
      '.que',
      '.question',
      '[class*="question-"]',
      '[id*="question-"]',
      '.formulation',
      '.mod_quiz .question',
      '#page-mod-quiz-review .que',
      '.path-mod-quiz .que'
    ];
    
    let questions = [];
    
    for (const selector of selectors) {
      questions = document.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${questions.length} questions`);
      
      if (questions.length > 0) {
        // Validate that these are actually question elements
        const firstQuestion = questions[0];
        const hasQuestionContent = firstQuestion.querySelector('.qtext') || 
                                 firstQuestion.querySelector('.questiontext') ||
                                 firstQuestion.textContent.toLowerCase().includes('question') ||
                                 firstQuestion.querySelector('input[type="radio"]') ||
                                 firstQuestion.querySelector('select') ||
                                 firstQuestion.querySelector('.answer');
        
        if (hasQuestionContent) {
          console.log(`Using selector: ${selector}`);
          break;
        }
      }
    }
    
    // If no questions found with standard selectors, try broader search
    if (questions.length === 0) {
      console.log('No questions found with standard selectors, trying broader search...');
      
      // Look for any element that might contain question content
      const allElements = document.querySelectorAll('*');
      const questionElements = Array.from(allElements).filter(el => {
        const text = el.textContent.toLowerCase();
        const className = el.className.toLowerCase();
        const id = el.id.toLowerCase();
        
        return (
          (className.includes('question') || id.includes('question') || className.includes('que')) &&
          (text.includes('correct') || text.includes('incorrect') || text.includes('answer') || text.includes('mark'))
        );
      });
      
      console.log(`Found ${questionElements.length} potential question elements via broad search`);
      questions = questionElements;
    }
    
    return Array.from(questions);
  }

parseShortAnswerQuestion(questionEl) {
    const questionText = questionEl.querySelector('.qtext')?.textContent.trim() || '';
    const studentAnswer = questionEl.querySelector('input[type="text"]')?.value || 
                        questionEl.querySelector('.form-control.d-inline')?.value || '';
    const feedback = questionEl.querySelector('.rightanswer')?.textContent.trim() || '';

    let correctAnswer = ''; // Initialize with an empty string
    const correctAnswerMatch = feedback.match(/The correct answer is:\s*(.+)/);
    if (correctAnswerMatch && correctAnswerMatch[1]) {
      correctAnswer = correctAnswerMatch[1].trim();
    } else {
      correctAnswer = feedback.replace(/The correct answer is:\s*/i, '').trim();
    }

    const isCorrect = questionEl.querySelector('.fa-check') !== null || 
                    questionEl.querySelector('.correct') !== null ||
                    questionEl.classList.contains('correct');

    return {
      questionText,
      studentAnswer,
      correctAnswer,
      feedback,
      isCorrect,
      type: 'shortanswer'
    };
  }

  // Parse matching questions
  parseMatchingQuestion(questionEl) {
    const questionText = questionEl.querySelector('.qtext')?.textContent.trim() || "";
    const matchingPairs = [];
    let isCorrect = false;
    let correctCount = 0;
    let totalCount = 0;
    
    // Try multiple selectors for matching questions
    const rows = questionEl.querySelectorAll('.answer tbody tr, .que .answer tr, [class*="match"] tr');
    
    rows.forEach(row => {
      // Look for item text and selected option
      const itemText = row.querySelector('.text, .item')?.textContent.trim();
      const selectedOption = row.querySelector('select option[selected], .selected, select option:checked')?.textContent.trim() || row.querySelector('select')?.value?.textContent.trim();
      const controlCell = row.querySelector('td.control, .control');

      const isCorrectPair = controlCell?.classList.contains('correct') || controlCell?.querySelector('i.fa-check') !== null || controlCell?.querySelector('.text-success') !== null;
      const isIncorrectPair = controlCell?.classList.contains('incorrect') || controlCell?.querySelector('i.fa-remove, i.fa-times') !== null || controlCell?.querySelector('.text-danger') !== null;
      
      if (itemText && (selectedOption || isCorrectPair || isIncorrectPair)) {
        totalCount++;
        
        const pair = {
          item: itemText,
          selectedAnswer: selectedOption || 'No answer',
          isCorrect: isCorrectPair,
          isIncorrect: isIncorrectPair
        };
        
        matchingPairs.push(pair);
        
        if (isCorrectPair) {
          correctCount++;
        }
      }
    });

    // Also try to find the correct answers from feedback or rightanswer section
    const rightAnswerSection = questionEl.querySelector('.rightanswer, .correct-answer');
    let correctAnswersText = '';
    if (rightAnswerSection) {
      correctAnswersText = rightAnswerSection.textContent.trim();
    }

    // Check if question is overall correct
    isCorrect = correctCount === totalCount && totalCount > 0;
    
    // If no matching pairs found, try alternative parsing
    if (matchingPairs.length === 0) {
      // Look for any table or structured content
      const tables = questionEl.querySelectorAll('table');
      tables.forEach(table => {
        const tableRows = table.querySelectorAll('tr');
        tableRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const item = cells[0]?.textContent.trim();
            const answer = cells[1]?.textContent.trim();
            if (item && answer && item !== 'Item' && answer !== 'Answer') { // Skip headers
              matchingPairs.push({
                item: item,
                selectedAnswer: answer,
                isCorrect: false,
                isIncorrect: false
              });
            }
          }
        });
      });
    }

    const feedback = questionEl.querySelector('.rightanswer, .feedback')?.textContent.trim() || '';
    
    return {
      questionText,
      matchingPairs,
      correctAnswersText,
      feedback,
      isCorrect,
      correctCount,
      totalCount,
      type: 'matching'
    };
  }

  // Parse true/false questions
  parseTrueFalseQuestion(questionEl) {
    const questionText = questionEl.querySelector('.qtext')?.textContent.trim() || '';
    const answers = [];
    let userAnswer = '';
    let isCorrect = false;
    
    const options = questionEl.querySelectorAll('.answer .r0, .answer .r1');
    options.forEach(option => {
      const label = option.querySelector('label')?.textContent.trim();
      const isSelected = option.querySelector('input[checked]') !== null;
      const isCorrectOption = option.querySelector('.fa-check') !== null;
      const isIncorrectOption = option.querySelector('.fa-remove') !== null;
      
      if (label) {
        answers.push({
          text: label,
          selected: isSelected,
          correct: isCorrectOption,
          incorrect: isIncorrectOption
        });

        if (isSelected) {
          userAnswer = label;
          isCorrect = isCorrectOption;
        }
      }
    });

    const feedback = questionEl.querySelector('.rightanswer')?.textContent.trim() || '';
    
    return {
      questionText,
      userAnswer,
      answers,
      correctAnswer: feedback,
      feedback,
      isCorrect,
      type: 'truefalse'
    };
  }

  // Parse multiple choice questions
  parseMultipleChoiceQuestion(questionEl) {
    const questionText = questionEl.querySelector('.qtext')?.textContent.trim() || '';
    const answers = [];
    let userAnswer = '';
    let isCorrect = false;
    
    const options = questionEl.querySelectorAll('.answer .r0, .answer .r1');
    options.forEach(option => {
      const answerDiv = option.querySelector('[data-region="answer-label"]');
      const answerNumber = answerDiv?.querySelector('.answernumber')?.textContent.trim() || '';
      const answerText = answerDiv?.querySelector('.flex-fill')?.textContent.trim() || '';
      const isSelected = option.querySelector('input[checked]') !== null;
      const isCorrectOption = option.querySelector('.fa-check') !== null;
      const isIncorrectOption = option.querySelector('.fa-remove') !== null;
      
      if (answerText) {
        answers.push({
          number: answerNumber,
          text: answerText,
          selected: isSelected,
          correct: isCorrectOption,
          incorrect: isIncorrectOption
        });

        if (isSelected) {
          userAnswer = `${answerNumber} ${answerText}`;
          isCorrect = isCorrectOption;
        }
      }
    });

    const feedback = questionEl.querySelector('.rightanswer')?.textContent.trim() || '';
    
    return {
      questionText,
      userAnswer,
      answers,
      correctAnswer: feedback,
      feedback,
      isCorrect,
      type: 'multiplechoice'
    };
  }

  // Format Short Answer question
  formatShortAnswerQuestion(question) {
    const correctnessIcon = question.isCorrect ? '✅' : '❌';
    const borderColor = question.isCorrect ? '#1abc9c' : '#e74c3c';
    
    return `
      <div class="question-container sa-container" style="border-left-color: ${borderColor}">
        <div class="question-header-line">
          <div class="question-left">
            <span class="question-text">${this.escapeHtml(question.questionText)}</span>
            <span class="user-answer-inline">Your Answer: <strong>${this.escapeHtml(question.studentAnswer || 'No answer')}</strong></span>
          </div>
          <div class="question-right">
            <span class="correctness-icon">${correctnessIcon}</span>
            <span class="question-grade">${this.parseScore(this.escapeHtml(question.grade)).score}</span>
          </div>
        </div>
        
        <div class="correct-answer-section">
          <strong>Correct Answer:</strong> ${this.escapeHtml(question.correctAnswer || 'Not available')}
        </div>
      </div>
    `;
  }

  // Parse generic questions (fallback)
  parseGenericQuestion(questionEl, index) {
    const questionText = questionEl.querySelector('.qtext')?.textContent.trim() || 
                         questionEl.querySelector('.questiontext')?.textContent.trim() || 
                         `Question ${index + 1}`;
    const answers = [];
    const feedback = questionEl.querySelector('.feedback')?.textContent.trim() || 
                     questionEl.querySelector('.rightanswer')?.textContent.trim() || 
                     'No feedback available';
    
    return {
      questionText,
      answers,
      correctAnswers: [],
      feedback,
      type: 'generic'
    };
  }
  parseScore(scoreText) {
    // This regex handles both "Mark X.XX out of Y.YY" and "Marked out of Y.YY"
    const regex = /Mark(?:ed)?\s+(?:(\d+\.\d+)\s+)?out\s+of\s+(\d+\.\d+)/;
    const match = scoreText.match(regex);

    if (match) {
      const score = match[1] || "0.00"; // Default to 0.00 if no score found
      const total = match[2];
      return {
        score: parseFloat(score),
        total: parseFloat(total)
      };
    } else {
      return {
        score: 0.00,
        total: 0.00
      };
    }
  }

  // Main parsing function with enhanced detection and sorting
  parseQuizResults(sortByType = false) {
    console.log('Starting to parse quiz results...');
    
    // First run debug to see what we're working with
    const hasQuizContent = this.debugPageContent();
    
    if (!hasQuizContent) {
      console.log('No quiz content detected');
      return [];
    }
    
    const questions = this.findQuestions();
    console.log(`Found ${questions.length} question elements`);
    
    if (questions.length === 0) {
      return [];
    }
    
    this.parsedResults = [];

    questions.forEach((questionEl, index) => {
      console.log(`Processing question ${index + 1}:`, questionEl);
      
      // Try to get question metadata
      let questionNumber = questionEl.querySelector('.qno')?.textContent.trim() || 
                          questionEl.querySelector('.questionname')?.textContent.trim() ||
                          (index + 1).toString();
      
      let state = questionEl.querySelector('.state')?.textContent.trim() || 
                 questionEl.querySelector('.grade')?.textContent.trim() || 
                 'Unknown';
      
      let grade = questionEl.querySelector('.grade')?.textContent.trim() || 
                 questionEl.querySelector('.points')?.textContent.trim() || 
                 '';
      
      // Clean up question number (remove "Question" text if present)
      questionNumber = questionNumber.replace(/^Question\s*/i, '').trim();
      
      let questionData;
      
      // Determine question type and parse accordingly
      if (questionEl.classList.contains('match') || questionEl.querySelector('.answer table')) {
        questionData = this.parseMatchingQuestion(questionEl);
      } else if (questionEl.classList.contains('truefalse') || 
                 (questionEl.querySelectorAll('input[type="radio"]').length === 2 &&
                  questionEl.textContent.toLowerCase().includes('true') &&
                  questionEl.textContent.toLowerCase().includes('false'))) {
        questionData = this.parseTrueFalseQuestion(questionEl);
      } else if (questionEl.querySelector('[data-region="answer-label"]') ||
                 questionEl.querySelectorAll('input[type="radio"]').length > 2) {
        questionData = this.parseMultipleChoiceQuestion(questionEl);
      } else if (questionEl.querySelector('input[type="text"]') || 
                 questionEl.querySelector('.form-control.d-inline') ||
                 questionEl.querySelector('.incorrect')?.closest('input')) {
        questionData = this.parseShortAnswerQuestion(questionEl);
      } else {
        questionData = this.parseGenericQuestion(questionEl, index);
      }

      this.parsedResults.push({
        number: questionNumber,
        state,
        grade,
        ...questionData
      });
    });

    // Sort by question type if requested, and change 'number' to index-based numbering
    if (sortByType) {
      const typeOrder = {
        'multiplechoice': 1,
        'shortanswer': 2,
        'truefalse': 3,
        'matching': 4,
        'generic': 5
      };
      this.parsedResults.sort((a, b) => {
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
      });
      this.parsedResults.forEach((question, index) => {
        question.number = index + 1;
      });
    }

    console.log('Parsing complete. Results:', this.parsedResults);
    return this.parsedResults;
  }

  // Format MCQ question with improved layout
  formatMCQQuestion(question) {
    const correctnessIcon = question.isCorrect ? '✅' : '❌';
    const borderColor = question.isCorrect ? '#1abc9c' : '#e74c3c';
    
    return `
      <div class="question-container mcq-container" style="border-left-color: ${borderColor}">
        <div class="question-header-line">
          <div class="question-left">
            <span class="question-text">${question.number}. ${this.escapeHtml(question.questionText)}</span>
          </div>
          <div class="question-right">
            <span class="correctness-icon">${correctnessIcon}</span>
            <span class="question-grade">${this.parseScore(this.escapeHtml(question.grade)).score}</span>
          </div>
        </div>
        
        <div class="options-grid">
          ${question.answers.map(answer => {
            const userCheckmark = answer.selected ? '<span class="user-mark">☑️</span>' : '';
            const correctnessIndicator = answer.correct ? '<span class="correct-indicator">✅</span>' : 
                                       answer.incorrect ? '<span class="incorrect-indicator">❌</span>' : '';
            return `
              <div class="option-row">
                <span class="option-label">${answer.number}</span>
                <span class="option-indicators">${userCheckmark}</span>
                <span class="option-text">${this.escapeHtml(answer.text)}</span>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="correct-answer-section">
          <strong>Correct Answer:</strong> ${this.escapeHtml(question.correctAnswer.replace("The correct answer is: ", "") || 'Not available')}
        </div>
      </div>
    `;
  }

  // Format True/False question with improved layout
  formatTrueFalseQuestion(question) {
    const correctnessIcon = question.isCorrect ? '✅' : '❌';
    const borderColor = question.isCorrect ? '#1abc9c' : '#e74c3c';
    
    return `
      <div class="question-container tf-container " style="border-left-color: ${borderColor}">
        <div class="question-header-line">
          <div class="question-left">
            <span class="question-text">${question.number}. ${this.escapeHtml(question.questionText)}</span>
            <span class="user-answer-inline">${this.escapeHtml(question.userAnswer)}</span>
          </div>
          <div class="question-right">
            <span class="correctness-icon">${correctnessIcon}</span>
            <span class="question-grade">${this.parseScore(this.escapeHtml(question.grade)).score}</span>
          </div>
        </div>
        
        <div class="correct-answer-section">
          <strong>Correct Answer:</strong> ${this.escapeHtml(question.correctAnswer.replace("The correct answer is ", "").replace(/['".]/g, '') || 'Not available')}
        </div>
      </div>
    `;
  }

  formatMatchingQuestion(question) {
    const correctnessIcon = question.isCorrect ? '✅' : '❌';
    const borderColor = question.isCorrect ? '#1abc9c' : '#e74c3c';
    
    let matchingPairsHtml = '';
    if (question.matchingPairs && question.matchingPairs.length > 0) {
      matchingPairsHtml = `
        <div class="matching-container">
          <strong>${question.number}. Match the following:</strong>
          <div class="matching-grid">
            ${question.matchingPairs.map((pair, index) => {
              const statusIcon = pair.isCorrect ? '<span class="correct-indicator">✅</span>' : 
                              pair.isIncorrect ? '<span class="incorrect-indicator">❌</span>' : 
                              '<span class="neutral-indicator">❌</span>';
              
              return `
                <div class="matching-row">
                  <div class="matching-item question-text">${index + 1}. ${this.escapeHtml(pair.item)}</div>
                  <div class="matching-arrow">→</div>
                  <div class="matching-answer user-answer-inline">${this.escapeHtml(pair.selectedAnswer)}</div>
                  <div class="matching-status">${statusIcon}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="matching-score">
            Score: ${question.correctCount || 0}/${question.totalCount || 0} correct
          </div>
        </div>
      `;
    }
      
    return `
      <div class="question-container matching-container-outer" style="border-left-color: ${borderColor}">
        <div class="question-header-line">
          <div class="question-left">
            <span class="question-text">${this.escapeHtml(question.questionText)}</span>
          </div>
          <div class="question-right">
            <span class="correctness-icon">${correctnessIcon}</span>
            <span class="question-grade">${this.parseScore(this.escapeHtml(question.grade)).score}</span>
          </div>
        </div>
        
        ${matchingPairsHtml}
        
        <div class="correct-answer-section">
          <strong>Correct Answers:</strong> ${this.escapeHtml(question.correctAnswersText.replace("The correct answer is: ", "") || question.feedback || 'Not available')}
        </div>
      </div>
    `;
  }
  // Format Fill in the blanks question
  formatFillBlanksQuestion(question) {
    const correctnessIcon = question.isCorrect ? '✅' : '❌';
    const borderColor = question.isCorrect ? '#1abc9c' : '#e74c3c';

    // Replace "Answer Question <n-digit number>" with the student's answer span
    const userAnswer = `<span class="user-answer-inline"><u>${this.escapeHtml(question.studentAnswer || '_______')}</u></span>`;

    var filledQuestionText = question.questionText || '';

    // If question text contains "Answer Question", replace it

    if (filledQuestionText.includes('Answer Question')) {
      filledQuestionText = (question.questionText || '').replace(/Answer Question \d+/, userAnswer);
    } else {
      filledQuestionText += ' ' + `<span class="user-answer-inline"><u>${this.escapeHtml(question.studentAnswer || '_______')}</u></span>`;
    }

    return `
      <div class="question-container fib-container" style="border-left-color: ${borderColor}">
        <div class="question-header-line">
          <div class="question-left">
            <span class="question-text">
              ${question.number}. ${filledQuestionText}
            </span>
          </div>
          <div class="question-right">
            <span class="correctness-icon">${correctnessIcon}</span>
            <span class="question-grade">${this.parseScore(this.escapeHtml(question.grade)).score}</span>
          </div>
        </div>
        
        <div class="correct-answer-section">
          <strong>Correct Answer:</strong> ${this.escapeHtml(question.correctAnswer.replace("The correct answer is: ", "") || 'Not available')}
        </div>
      </div>
    `;
  }

  // Generate HTML for download
  generateDownloadHTML() {
    if (this.parsedResults.length === 0) {
      return '<html><body><h1>No quiz results found</h1></body></html>';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.getTestName())}</title>
    <style>
      body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 10px;
          color: #333;
          background-color: #f5f7fa;
      }

      .container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 15px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }

      h1 {
          color: #2c3e50;
          border-bottom: 2px solid #3498db;
          padding-bottom: 5px;
          margin-bottom: 10px;
          align-items: center;
          justify-content: center;
          display: flex;
      }

      .header-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          color: #7f8c8d;
          font-size: 0.9em;
      }

      .quiz-summary {
          background: lightblue;
          color: rgb(0, 0, 0);
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 20px;
      }

      .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          row-gap: 0.5rem;
          column-gap: 1rem;
          align-items: center;
      }

      .summary-item {
          display: contents;
      }

      .summary-label {
          font-weight: bold;
          text-align: left;
      }

      .summary-value {
          text-align: left;
      }

      .marks {
          font-size: 1.2em;
          font-weight: bold;
      }

      .question-container {
          margin-bottom: 10px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 6px;
          border-left: 5px solid #3498db;
      }

      .question-header-line {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
          gap: 15px;
      }

      .question-left {
          flex: 1;
      }

      .question-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
      }

      .question-text {
          font-weight: 600;
          color: #2c3e50;
          font-size: 1.1em;
          line-height: 1.4;
      }

      .correctness-icon {
          font-size: 1.2em;
      }

      .question-grade {
          background: #e74c3c;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 1em;
          font-weight: bold;
      }

      .user-answer-inline {
          margin-left: 5px;
          color: #2980b9;
          margin-right: 5px;
          font-weight: bold;
      }

      .options-grid {
          margin: 8px 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 8px;
      }

      .option-row {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
          display: inline;
      }

      .option-row:last-child {
          border-bottom: none;
      }

      .option-label {
          font-weight: bold;
          margin-right: 6px;
          min-width: 18px;
          color: #495057;
      }

      .option-text {
          flex: 1;
          padding-right: 15px;
      }

      .option-indicators {
          display: flex;
          gap: 2px;
          align-items: center;
          display: inline-block;
      }

      .user-mark {
          font-size: 1.1em;
      }

      .correct-indicator {
          font-size: 1.1em;
      }

      .incorrect-indicator {
          font-size: 1.1em;
      }

      .your-answer {
          color: #2980b9;
      }

      .correct-answer-section {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          padding: 4px;
          border-radius: 4px;
          margin-top: 8px;
          color: #155724;
      }

      .footer {
          margin-top: 20px;
          text-align: center;
          color: #7f8c8d;
          font-size: 0.8em;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
      }

      .moodle-parser-container {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 500px;
          max-height: 85vh;
          background: white;
          border: none;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          overflow: hidden;
          animation: slideIn 0.3s ease-out;
      }

      .moodle-parser-header {
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
      }

      .moodle-parser-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
      }

      .header-buttons {
          display: flex;
          gap: 12px;
      }

      .download-btn {
          background: #2ecc71;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
      }

      .download-btn:hover {
          background: #27ae60;
          transform: translateY(-1px);
      }

      .close-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
      }

      .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
      }

      .quiz-summary-widget {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 15px 20px;
          border-bottom: 1px solid #eee;
      }

      .summary-title {
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 14px;
      }

      .summary-stats {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
      }

      .moodle-parser-content {
          padding: 20px;
          overflow-y: auto;
          max-height: calc(85vh - 140px);
      }

      .question-item {
          margin-bottom: 20px;
      }

      .mcq-container {
          border-left-color: #e74c3c;
      }

      .tf-container {
          border-left-color: #f39c12;
      }

      .sa-container,
      .fib-container {
          border-left-color: #9b59b6;
      }

      .matching-container-outer {
          border-left-color: #1abc9c;
      }

      .matching-container {
          margin: 12px 0;
      }

      .matching-grid {
          margin: 8px 0;
          background: white;
          border-radius: 4px;
          padding: 8px;
          border: 1px solid #dee2e6;
      }

      .matching-row {
          display: grid;
          grid-template-columns: 1fr 5% 1fr 6%;
          gap: 1%;
          align-items: center;
          padding: 0 2%;
      }

      .matching-row:last-child {
          border-bottom: none;
      }

      .matching-item {
          font-weight: 500;
          color: #2c3e50;
      }

      .matching-arrow {
          text-align: center;
          color: #7f8c8d;
          font-weight: bold;
      }

      .matching-answer {
          color: #2980b9;
      }

      .matching-status {
          text-align: center;
      }

      .matching-score {
          margin-top: 10px;
          font-weight: 600;
          color: #34495e;
          font-size: 12px;
          text-align: center;
          background: #ecf0f1;
          padding: 6px;
          border-radius: 4px;
      }

      /* Scrollbar styling */
      .moodle-parser-content::-webkit-scrollbar {
          width: 6px;
      }

      .moodle-parser-content::-webkit-scrollbar-track {
          background: #f1f1f1;
      }

      .moodle-parser-content::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
      }

      .moodle-parser-content::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
      }

      /* Animations */
      @keyframes slideIn {
          from {
              transform: translateX(100%);
              opacity: 0;
          }
          to {
              transform: translateX(0);
              opacity: 1;
          }
      }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 ${this.escapeHtml(this.getTestName())}</h1>
        <div class="header-info">
            <div>📅 Generated: ${dateStr} at ${timeStr}</div>
            <div>🔗 Source: ${window.location.href}</div>
        </div>
`;

    // Add quiz summary if available
    const quizSummary = this.parseQuizSummary();
    if (quizSummary) {
      html += `
        <div class="quiz-summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">👤 Student</div>
                    <div class="summary-value">${this.escapeHtml(quizSummary.userName || 'Unknown')}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">🕐 Started</div>
                    <div class="summary-value">${this.escapeHtml(quizSummary.startedOn || 'N/A')}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">✅ Completed</div>
                    <div class="summary-value">${this.escapeHtml(quizSummary.completedOn || 'N/A')}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">⏱️ Duration</div>
                    <div class="summary-value">${this.escapeHtml(quizSummary.timeTaken || 'N/A')}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">📝 Marks</div>
                    <div class="summary-value marks">${this.escapeHtml(quizSummary.marks || 'N/A')}</div>
                </div>
            </div>
        </div>
      `;
    }

    // Add each question
    this.parsedResults.forEach(question => {
      let questionHtml = '';
      if (question.type === 'multiplechoice') {
        questionHtml = this.formatMCQQuestion(question);
      } else if (question.type === 'truefalse') {
        questionHtml = this.formatTrueFalseQuestion(question);
      } else if (question.type === 'matching') {
        questionHtml = this.formatMatchingQuestion(question);
      } else if (question.type === 'shortanswer') {
          questionHtml = this.formatFillBlanksQuestion(question);
      }
      
      html += questionHtml;
    });

    html += `
        <div class="footer">
            🚀 Generated by Zion School's Moodle Quiz Results Parser (Chrome Extension) <br>
            Zion Nursery & Primary School, Kovaipudur, Coimbatore, India. <br>
            <a href="https://github.com/zion-school/moodle-quiz-results-parser" target="_blank">https://github.com/zion-school/moodle-quiz-results-parser</a>
        </div>
    </div>
</body>
</html>
    `;

    return html;
  }

  // Create and display the parsed results
  displayResults(sortByType = false) {
    console.log('displayResults called with sortByType:', sortByType);
    
    // Remove existing display
    const existing = document.getElementById('moodle-parser-results');
    if (existing) {
      existing.remove();
      this.isVisible = false;
      return;
    }

    const results = this.parseQuizResults(sortByType);
    console.log('Parsed results:', results);
    
    if (results.length === 0) {
      // Show debug info in alert
      const debugInfo = this.getDebugInfo();
      alert(`No Moodle quiz questions found on this page.\n\nDebug Info:\n${debugInfo}`);
      return;
    }

    // Create results container
    const container = document.createElement('div');
    container.id = 'moodle-parser-results';
    container.className = 'moodle-parser-container';

    // Add header with download button
    const header = document.createElement('div');
    header.className = 'moodle-parser-header';
    header.innerHTML = `
      <h3>📋 Quiz Results (${results.length} questions)</h3>
      <div class="header-buttons">
        <button id="download-results" class="download-btn">📥 Download</button>
        <button id="close-parser" class="close-btn">×</button>
      </div>
    `;
    container.appendChild(header);

    // Add results content
    const content = document.createElement('div');
    content.className = 'moodle-parser-content';
    
    results.forEach(question => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      
      let questionHtml = '';
      if (question.type === 'multiplechoice') {
        questionHtml = this.formatMCQQuestion(question);
      } else if (question.type === 'truefalse') {
        questionHtml = this.formatTrueFalseQuestion(question);
      } else if (question.type === 'shortanswer') {
          questionHtml = this.formatFillBlanksQuestion(question);
      } else if (question.type === 'matching') {
          questionHtml = this.formatMatchingQuestion(question);
      } else {
          // Handle generic or unknown question types
      }
      
      questionDiv.innerHTML = questionHtml;
      content.appendChild(questionDiv);
    });

    container.appendChild(content);

    // Add to page
    document.body.appendChild(container);
    this.isVisible = true;

    // Add close functionality
    document.getElementById('close-parser').addEventListener('click', () => {
      container.remove();
      this.isVisible = false;
    });

    // Add download functionality
    document.getElementById('download-results').addEventListener('click', () => {
      const htmlContent = this.generateDownloadHTML();
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `moodle-quiz-results-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  // Helper function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Get debug information for troubleshooting
  getDebugInfo() {
    const info = [];
    info.push(`URL: ${window.location.href}`);
    info.push(`Title: ${document.title}`);
    
    const selectors = ['.que', '.question', '#page-mod-quiz-review', '.mod-quiz', '.generaltable.quizreviewsummary'];
    selectors.forEach(sel => {
      const count = document.querySelectorAll(sel).length;
      info.push(`${sel}: ${count} elements`);
    });
    
    return info.join('\n');
  }
}

// Initialize parser
const moodleParser = new MoodleParser();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parseQuiz') {
    moodleParser.displayResults(request.sortByType);
    sendResponse({success: true});
  }
});

// Add keyboard shortcut (Ctrl+Shift+M)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    moodleParser.displayResults();
  }
});