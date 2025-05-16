// Save options to chrome.storage
function saveOptions() {
  const devMode = document.getElementById('devMode').checked;
  
  chrome.storage.local.set(
    { devMode: devMode },
    function() {
      // Update status to let user know options were saved
      const status = document.getElementById('status');
      status.textContent = 'Options saved!';
      status.classList.add('visible', 'success');
      
      setTimeout(function() {
        status.classList.remove('visible');
      }, 1500);
    }
  );
}

// Restore options from chrome.storage
function restoreOptions() {
  chrome.storage.local.get(
    { devMode: false }, // default value
    function(items) {
      document.getElementById('devMode').checked = items.devMode;
    }
  );
}

// Initialize the page and add event listeners
document.addEventListener('DOMContentLoaded', function() {
  restoreOptions();
  document.getElementById('devMode').addEventListener('change', saveOptions);
});
