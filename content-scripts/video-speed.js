(function () {
  "use strict";

  let currentSpeed = 1.5;
  let speedRules = {};
  let globalSpeed = 1.5;
  let currentZoom = 100;

  // Load settings from storage (only speed settings, not zoom)
  chrome.storage.sync.get(["speedRules", "globalSpeed"], (result) => {
    speedRules = result.speedRules || {};
    globalSpeed = result.globalSpeed || 1.5;

    // Zoom always starts at 100% (no zoom) - not saved between sessions
    currentZoom = 100;

    // Determine speed for current site
    const hostname = window.location.hostname;
    currentSpeed = speedRules[hostname] || globalSpeed;

    // Apply initial speed only (no zoom by default)
    setSpeed();
  });

  // Listen for messages from popup
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
    } else if (request.action === "setZoom") {
      currentZoom = request.zoom;
      applyZoom();
    } else if (request.action === "getZoom") {
      // Return current zoom level to popup
      sendResponse({ zoom: currentZoom });
    }
  });

  // Listen for storage changes (only for speed settings)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "sync") {
      if (changes.speedRules) {
        speedRules = changes.speedRules.newValue || {};
      }
      if (changes.globalSpeed) {
        globalSpeed = changes.globalSpeed.newValue || 1.5;
      }
      // No longer listening for customZoomValue changes
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

  function applyZoom() {
    document.querySelectorAll("video").forEach((video) => {
      // Skip if already has the correct zoom to avoid reapplying
      if (video.dataset.appliedZoom === String(currentZoom)) {
        return;
      }

      // Reset all styles first
      video.style.removeProperty("transform");
      video.style.removeProperty("transform-origin");
      video.style.removeProperty("object-fit");

      if (currentZoom === 100) {
        // 16:9 - Original aspect ratio, no changes
        delete video.dataset.appliedZoom;

        // Reset parent overflow
        const parent = video.parentElement;
        if (parent && parent.dataset.zoomModified === "true") {
          parent.style.removeProperty("overflow");
          delete parent.dataset.zoomModified;
        }
      } else {
        // Apply zoom - scale the video to crop it
        const scale = currentZoom / 100;
        video.style.transform = `scale(${scale})`;
        video.style.transformOrigin = "center center";
        video.dataset.appliedZoom = String(currentZoom);

        // Hide overflow on parent
        const parent = video.parentElement;
        if (parent) {
          parent.style.overflow = "hidden";
          parent.dataset.zoomModified = "true";
        }
      }
    });
  }

  // Initial setup
  setSpeed();

  // MutationObserver to handle dynamically added videos
  const observer = new MutationObserver(() => {
    // Apply speed to new videos
    setSpeed();

    // Only reapply zoom if zoom is active
    if (currentZoom !== 100) {
      // Apply zoom to new videos only
      document.querySelectorAll("video").forEach((video) => {
        if (!video.dataset.appliedZoom) {
          const scale = currentZoom / 100;
          video.style.transform = `scale(${scale})`;
          video.style.transformOrigin = "center center";
          video.dataset.appliedZoom = String(currentZoom);

          const parent = video.parentElement;
          if (parent && parent.dataset.zoomModified !== "true") {
            parent.style.overflow = "hidden";
            parent.dataset.zoomModified = "true";
          }
        }
      });
    }
  });

  // Start observing
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

  // Handle play events
  document.addEventListener(
    "play",
    (e) => {
      if (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO") {
        e.target.playbackRate = currentSpeed;

        // Apply zoom to video if needed
        if (e.target.tagName === "VIDEO" && currentZoom !== 100) {
          const video = e.target;
          if (
            !video.dataset.appliedZoom ||
            video.dataset.appliedZoom !== String(currentZoom)
          ) {
            const scale = currentZoom / 100;
            video.style.transform = `scale(${scale})`;
            video.style.transformOrigin = "center center";
            video.dataset.appliedZoom = String(currentZoom);

            const parent = video.parentElement;
            if (parent && parent.dataset.zoomModified !== "true") {
              parent.style.overflow = "hidden";
              parent.dataset.zoomModified = "true";
            }
          }
        }
      }
    },
    true,
  );

  // Periodic check for speed only (not zoom to avoid flickering)
  setInterval(() => {
    document.querySelectorAll("video, audio").forEach((el) => {
      if (el.playbackRate !== currentSpeed) {
        el.playbackRate = currentSpeed;
      }
    });
  }, 1000);
})();
