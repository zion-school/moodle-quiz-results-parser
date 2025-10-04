/*  Moodle Quiz Results Parser - popup.js
 *  
 *  Copyright (c) 2025 Zion Nursery & Primary School, Kovaipudur
 *  
 *  Date : 24-Sep-2025
 */

document.addEventListener('DOMContentLoaded', () => {
  const parseBtn = document.getElementById('parseBtn');
  const status = document.getElementById('status');
  const sortByTypeCheckbox = document.getElementById('sortByType');

  parseBtn.addEventListener('click', async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        showStatus('error', 'Could not get current tab');
        return;
      }

      const sortByType = sortByTypeCheckbox.checked;

      // First try to inject CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
      } catch (cssError) {
        console.log('CSS already injected or failed to inject:', cssError);
      }

      // Try to send message first (in case content script is already loaded)
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'parseQuiz',
          sortByType: sortByType
        });
        
        if (response && response.success) {
          showStatus('success', 'Quiz results parsed successfully!');
          setTimeout(() => {
            window.close();
          }, 1000);
          return;
        }
      } catch (messageError) {
        console.log('Content script not loaded, will inject it');
      }

      // If message failed, inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Wait a moment for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try again after injecting
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'parseQuiz',
          sortByType: sortByType
        });
        
        if (response && response.success) {
          showStatus('success', 'Quiz results parsed successfully!');
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          showStatus('error', 'No quiz questions found. Check console for debug info.');
        }
      } catch (injectionError) {
        console.error('Injection error:', injectionError);
        showStatus('error', 'Could not access this page. Try refreshing the page first.');
      }
    } catch (error) {
      console.error('Error parsing quiz:', error);
      showStatus('error', 'An error occurred. Check console for details.');
    }
  });

  function showStatus(type, message) {
    status.textContent = message;
    status.className = `status ${type}`;
    
    if (type === 'error') {
      // Keep error messages visible longer
      setTimeout(() => {
        status.style.display = 'none';
      }, 5000);
    } else if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    }
  }
});