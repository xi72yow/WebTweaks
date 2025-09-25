(function () {
  "'use strict";

  let currentSpeed = 1.5;
  let speedRules = {};
  let globalSpeed = 1.5;

  // Load settings from storage
  chrome.storage.sync.get(["speedRules", "globalSpeed"], (result) => {
    speedRules = result.speedRules || {};
    globalSpeed = result.globalSpeed || 1.5;

    // Determine speed for current site
    const hostname = window.location.hostname;
    currentSpeed = speedRules[hostname] || globalSpeed;

    // Apply initial speed
    setSpeed();
  });

  // Initial
  // Listen for speed changes from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "setSpeed") {
      currentSpeed = request.speed;
      setSpeed();
    } else if (request.action === "updateRules") {
      speedRules = request.rules;
      globalSpeed = request.globalSpeed;
      const hostname = window.location.hostname;
      currentSpeed = speedRules[hostname] || globalSpeed;
      setSpeed();
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.speedRules) {
        speedRules = changes.speedRules.newValue || {};
      }
      if (changes.globalSpeed) {
        globalSpeed = changes.globalSpeed.newValue || 1.5;
      }
      const hostname = window.location.hostname;
      currentSpeed = speedRules[hostname] || globalSpeed;
      setSpeed();
    }
  });

  function setSpeed() {
    document.querySelectorAll("video, audio").forEach((el) => {
      el.playbackRate = currentSpeed;
    });
  }

  // Initial setup
  setSpeed();

  // MutationObserver
  const observer = new MutationObserver(setSpeed);

  // Function to start observing
  function startObserving() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Try to start observing immediately
  startObserving();

  // Also try when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserving);
  }

  // Fallback for edge cases
  if (!document.body) {
    const checkBody = setInterval(() => {
      if (document.body) {
        startObserving();
        clearInterval(checkBody);
      }
    }, 100);
  }

  // Events
  document.addEventListener(
    "play",
    (e) => {
      if (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO") {
        e.target.playbackRate = currentSpeed;
      }
    },
    true,
  );
  currentSpeed;
  // Periodic check
  setInterval(setSpeed, 1000);
})();
