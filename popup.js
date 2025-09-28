// Open in new window button
document.getElementById("openInWindow").addEventListener("click", () => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 450,
    height: 600,
  });
  window.close();
});

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    // Remove active from all tabs and contents
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    // Add active to clicked tab
    tab.classList.add("active");

    // Show corresponding content
    const tabName = tab.dataset.tab;
    if (tabName === "speed") {
      document.getElementById("speedTab").classList.add("active");
    } else if (tabName === "twitch") {
      document.getElementById("twitchTab").classList.add("active");
    }
  });
});

// Video Speed Controller Logic
let speedRules = {};
let globalSpeed = 1.5;
let currentZoomPreset = "none";
let customZoomValue = 100;

// Load settings
chrome.storage.sync.get(["speedRules", "globalSpeed"], (result) => {
  speedRules = result.speedRules || {};
  globalSpeed = result.globalSpeed || 1.5;

  document.getElementById("globalSpeedSlider").value = globalSpeed;
  document.getElementById("globalSpeedValue").textContent = globalSpeed + "x";

  updateRulesList();
});

// Get current tab URL
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    try {
      const url = new URL(tabs[0].url);
      const hostname = url.hostname;
      document.getElementById("currentUrl").textContent =
        hostname || tabs[0].url;

      // Check if there's a rule for this site
      const currentSpeed = speedRules[hostname] || globalSpeed;
      document.getElementById("currentSpeedSlider").value = currentSpeed;
      document.getElementById("currentSpeedValue").textContent =
        currentSpeed + "x";
    } catch (e) {
      // Handle special URLs (chrome://, edge://, about:, etc.)
      document.getElementById("currentUrl").textContent = tabs[0].url || "-";
    }
  }
});

// Helper function to check if URL supports content scripts
function canInjectContentScript(url) {
  if (!url) return false;
  // Content scripts cannot run on chrome://, chrome-extension://, edge://, about:, etc.
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  );
}

// Speed slider handlers
document.getElementById("currentSpeedSlider").addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  document.getElementById("currentSpeedValue").textContent = value + "x";

  // Apply immediately to current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && canInjectContentScript(tabs[0].url)) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          action: "setSpeed",
          speed: value,
        })
        .catch(() => {
          // Silently ignore if content script is not available
        });
    }
  });
});

document.getElementById("globalSpeedSlider").addEventListener("input", (e) => {
  globalSpeed = parseFloat(e.target.value);
  document.getElementById("globalSpeedValue").textContent = globalSpeed + "x";

  // Save global speed
  chrome.storage.sync.set({ globalSpeed });
});

// Save current speed for this site
document.getElementById("saveCurrentSpeed").addEventListener("click", () => {
  const hostname = document.getElementById("currentUrl").textContent;
  const speed = parseFloat(document.getElementById("currentSpeedSlider").value);

  if (hostname && hostname !== "-") {
    speedRules[hostname] = speed;
    chrome.storage.sync.set({ speedRules }, () => {
      updateRulesList();
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && canInjectContentScript(tabs[0].url)) {
          chrome.tabs
            .sendMessage(tabs[0].id, {
              action: "updateRules",
              rules: speedRules,
              globalSpeed: globalSpeed,
            })
            .catch(() => {
              // Silently ignore if content script is not available
            });
        }
      });
    });
  }
});

// Add new rule
document.getElementById("addRuleBtn").addEventListener("click", () => {
  const url = document.getElementById("newRuleUrl").value.trim();
  const speed = parseFloat(document.getElementById("newRuleSpeed").value);

  if (url && !isNaN(speed) && speed >= 0.25 && speed <= 3) {
    speedRules[url] = speed;
    chrome.storage.sync.set({ speedRules }, () => {
      updateRulesList();
      document.getElementById("newRuleUrl").value = "";
      document.getElementById("newRuleSpeed").value = "";
    });
  }
});

// Function to update active zoom button
function updateActiveZoomButton(zoomLevel) {
  // Remove active class from all buttons
  document.querySelectorAll(".zoom-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Add active class to the appropriate button
  if (zoomLevel === 120) {
    document.getElementById("quickZoom21Soft").classList.add("active");
  } else if (zoomLevel === 131) {
    document.getElementById("quickZoom21").classList.add("active");
  } else if (zoomLevel === 140) {
    document.getElementById("quickZoom32Soft").classList.add("active");
  } else if (zoomLevel === 200) {
    document.getElementById("quickZoom32").classList.add("active");
  } else {
    // For 100 or any other value, default to Original
    document.getElementById("quickZoomReset").classList.add("active");
  }
}

// Quick Zoom Buttons
// 21:9 Soft - Less aggressive crop
document.getElementById("quickZoom21Soft").addEventListener("click", () => {
  const zoomLevel = 120;
  applyZoomLevel(zoomLevel);
  updateActiveZoomButton(zoomLevel);
  // Update custom slider to reflect the zoom
  document.getElementById("customZoom").value = zoomLevel;
  document.getElementById("customZoomValue").textContent = zoomLevel + "%";
  customZoomValue = zoomLevel;
  // Don't save zoom to storage - keep it session-only
});

// 21:9 - Exact ultrawide crop
document.getElementById("quickZoom21").addEventListener("click", () => {
  const zoomLevel = 131;
  applyZoomLevel(zoomLevel);
  updateActiveZoomButton(zoomLevel);
  // Update custom slider to reflect the zoom
  document.getElementById("customZoom").value = zoomLevel;
  document.getElementById("customZoomValue").textContent = zoomLevel + "%";
  customZoomValue = zoomLevel;
  // Don't save zoom to storage - keep it session-only
});

// 32:9 Soft - Moderate crop
document.getElementById("quickZoom32Soft").addEventListener("click", () => {
  const zoomLevel = 140;
  applyZoomLevel(zoomLevel);
  updateActiveZoomButton(zoomLevel);
  // Update custom slider to reflect the zoom
  document.getElementById("customZoom").value = zoomLevel;
  document.getElementById("customZoomValue").textContent = zoomLevel + "%";
  customZoomValue = zoomLevel;
  // Don't save zoom to storage - keep it session-only
});

// 32:9 - Full super ultrawide crop
document.getElementById("quickZoom32").addEventListener("click", () => {
  const zoomLevel = 200;
  applyZoomLevel(zoomLevel);
  updateActiveZoomButton(zoomLevel);
  // Update custom slider to reflect the zoom
  document.getElementById("customZoom").value = zoomLevel;
  document.getElementById("customZoomValue").textContent = zoomLevel + "%";
  customZoomValue = zoomLevel;
  // Don't save zoom to storage - keep it session-only
});

document.getElementById("quickZoomReset").addEventListener("click", () => {
  const zoomLevel = 100;
  applyZoomLevel(zoomLevel);
  updateActiveZoomButton(zoomLevel);
  // Reset custom slider
  document.getElementById("customZoom").value = 100;
  document.getElementById("customZoomValue").textContent = "100%";
  customZoomValue = 100;
  // Don't save zoom to storage - keep it session-only
});

// Custom Zoom Controls
document.getElementById("customZoom").addEventListener("input", (e) => {
  customZoomValue = parseInt(e.target.value);
  document.getElementById("customZoomValue").textContent =
    customZoomValue + "%";
  // Don't save zoom to storage - keep it session-only
});

document.getElementById("applyCustomZoom").addEventListener("click", () => {
  applyZoomLevel(customZoomValue);
});

// Helper function to apply zoom
function applyZoomLevel(zoomLevel) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && canInjectContentScript(tabs[0].url)) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          action: "setZoom",
          zoom: zoomLevel,
        })
        .catch(() => {
          // Silently ignore - content script not available on this page
        });
    }
  });
}

// Query current zoom from the active tab's content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && canInjectContentScript(tabs[0].url)) {
    chrome.tabs
      .sendMessage(tabs[0].id, { action: "getZoom" })
      .then((response) => {
        if (response && response.zoom) {
          customZoomValue = response.zoom;
        } else {
          customZoomValue = 100;
        }
        document.getElementById("customZoom").value = customZoomValue;
        document.getElementById("customZoomValue").textContent =
          customZoomValue + "%";
        updateActiveZoomButton(customZoomValue);
      })
      .catch(() => {
        // Fallback if content script is not ready or page was just loaded
        customZoomValue = 100;
        document.getElementById("customZoom").value = customZoomValue;
        document.getElementById("customZoomValue").textContent =
          customZoomValue + "%";
        updateActiveZoomButton(customZoomValue);
      });
  } else {
    // Default to 100 for non-content script pages
    customZoomValue = 100;
    document.getElementById("customZoom").value = customZoomValue;
    document.getElementById("customZoomValue").textContent =
      customZoomValue + "%";
    updateActiveZoomButton(customZoomValue);
  }
});

// Update rules list display
function updateRulesList() {
  const container = document.getElementById("speedRules");

  if (Object.keys(speedRules).length === 0) {
    container.innerHTML =
      '<div class="empty-state">Keine Regeln gespeichert</div>';
    return;
  }

  container.innerHTML = "";
  for (const [url, speed] of Object.entries(speedRules)) {
    const ruleDiv = document.createElement("div");
    ruleDiv.className = "rule-item";
    ruleDiv.innerHTML = `
            <span class="rule-url">${url}</span>
            <span class="rule-speed">${speed}x</span>
            <button class="remove-btn" data-url="${url}">×</button>
        `;
    container.appendChild(ruleDiv);
  }

  // Add remove handlers
  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.target.dataset.url;
      delete speedRules[url];
      chrome.storage.sync.set({ speedRules }, updateRulesList);
    });
  });
}

// Twitch Live Tracker Logic (existing code)
let accessToken = null;
let refreshToken = null;
let clientId = null;
let userId = null;

// Check if already logged in
chrome.storage.local.get(
  ["twitchAccessToken", "twitchRefreshToken", "twitchClientId", "twitchUserId"],
  (result) => {
    if (result.twitchAccessToken && result.twitchClientId) {
      accessToken = result.twitchAccessToken;
      refreshToken = result.twitchRefreshToken;
      clientId = result.twitchClientId;
      userId = result.twitchUserId;
      showUserSection();
    }
  },
);

// Login button handler
document.getElementById("loginButton").addEventListener("click", async () => {
  const accessTokenInput = document
    .getElementById("accessTokenInput")
    .value.trim();
  const refreshTokenInput = document
    .getElementById("refreshTokenInput")
    .value.trim();
  const clientIdInput = document.getElementById("clientIdInput").value.trim();

  if (!accessTokenInput || !clientIdInput) {
    alert("Bitte Access Token und Client ID eingeben!");
    return;
  }

  // Validate token
  try {
    const response = await fetch("https://id.twitch.tv/oauth2/validate", {
      headers: {
        Authorization: `Bearer ${accessTokenInput}`,
      },
    });

    if (!response.ok) {
      throw new Error("Token ungültig");
    }

    const data = await response.json();
    userId = data.user_id;

    // Save tokens
    chrome.storage.local.set({
      twitchAccessToken: accessTokenInput,
      twitchRefreshToken: refreshTokenInput,
      twitchClientId: clientIdInput,
      twitchUserId: userId,
    });

    accessToken = accessTokenInput;
    refreshToken = refreshTokenInput;
    clientId = clientIdInput;

    showUserSection();
  } catch (error) {
    alert("Fehler: " + error.message);
  }
});

// Logout handler
document.getElementById("logoutButton").addEventListener("click", () => {
  chrome.storage.local.remove([
    "twitchAccessToken",
    "twitchRefreshToken",
    "twitchClientId",
    "twitchUserId",
  ]);
  accessToken = null;
  refreshToken = null;
  clientId = null;
  userId = null;
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("userSection").style.display = "none";
  document.getElementById("accessTokenInput").value = "";
  document.getElementById("refreshTokenInput").value = "";
});

// Refresh button handler
document.getElementById("refreshButton").addEventListener("click", () => {
  loadFollowedChannels();
});

// Open live streams buttons - only add if elements exist
const openLiveStreamsBtn = document.getElementById("openLiveStreams");
if (openLiveStreamsBtn) {
  openLiveStreamsBtn.addEventListener("click", () => {
    const liveChannels = Array.from(
      document.querySelectorAll(".channel-item.live"),
    ).map((el) => el.dataset.channel);

    if (liveChannels.length === 0) {
      alert("Keine Live-Streams gefunden!");
      return;
    }

    // Create new window with all streams as tabs
    chrome.windows.create({
      url: liveChannels.map((channel) => `https://twitch.tv/${channel}`),
      focused: true,
      state: "maximized",
    });
  });
}

const openLiveStreamsSeparateBtn = document.getElementById(
  "openLiveStreamsSeparate",
);
if (openLiveStreamsSeparateBtn) {
  openLiveStreamsSeparateBtn.addEventListener("click", () => {
    const liveChannels = Array.from(
      document.querySelectorAll(".channel-item.live"),
    ).map((el) => el.dataset.channel);

    if (liveChannels.length === 0) {
      alert("Keine Live-Streams gefunden!");
      return;
    }

    // Calculate optimal grid layout
    const numStreams = liveChannels.length;
    let cols, rows;

    if (numStreams === 1) {
      cols = 1;
      rows = 1;
    } else if (numStreams === 2) {
      cols = 2;
      rows = 1;
    } else if (numStreams === 3) {
      cols = 3;
      rows = 1;
    } else if (numStreams === 4) {
      cols = 2;
      rows = 2;
    } else if (numStreams <= 6) {
      cols = 3;
      rows = 2;
    } else if (numStreams <= 9) {
      cols = 3;
      rows = 3;
    } else if (numStreams <= 12) {
      cols = 4;
      rows = 3;
    } else if (numStreams <= 16) {
      cols = 4;
      rows = 4;
    } else {
      cols = Math.ceil(Math.sqrt(numStreams));
      rows = Math.ceil(numStreams / cols);
    }

    // Get screen dimensions
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;

    const windowWidth = Math.floor(screenWidth / cols);
    const windowHeight = Math.floor(screenHeight / rows);

    // Create windows sequentially with forced positioning
    function createWindowAtPosition(channel, index) {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const leftPos = col * windowWidth;
      const topPos = row * windowHeight;

      console.log(
        `Window ${index}: pos(${leftPos},${topPos}) size(${windowWidth}x${windowHeight})`,
      );

      chrome.windows.create(
        {
          url: `https://twitch.tv/${channel}`,
          type: "normal",
          state: "normal",
          focused: false,
          width: windowWidth,
          height: windowHeight,
          left: leftPos,
          top: topPos,
        },
        (window) => {
          // Immediately force the position again
          setTimeout(() => {
            chrome.windows.update(window.id, {
              left: leftPos,
              top: topPos,
              width: windowWidth,
              height: windowHeight,
              state: "normal",
            });
          }, 50);
        },
      );
    }

    // Create all windows with increasing delay
    liveChannels.forEach((channel, index) => {
      setTimeout(() => {
        createWindowAtPosition(channel, index);
      }, index * 250); // 250ms between windows
    });
  });
}

async function showUserSection() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("userSection").style.display = "block";

  // Get user info
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/users?id=${userId}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      document.getElementById("userName").textContent =
        `👤 ${data.data[0].display_name}`;
    }
  } catch (error) {
    console.error("Error fetching user info:", error);
  }

  loadFollowedChannels();
}

async function loadFollowedChannels() {
  const channelsList = document.getElementById("channelsList");
  channelsList.innerHTML = '<div class="loading">Lade gefolgte Kanäle...</div>';

  try {
    // Get followed channels
    const followResponse = await fetch(
      `https://api.twitch.tv/helix/channels/followed?user_id=${userId}&first=100`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!followResponse.ok) {
      throw new Error("Fehler beim Laden der Kanäle");
    }

    const followData = await followResponse.json();
    const channels = followData.data;

    // Get live streams
    const channelIds = channels.map((c) => c.broadcaster_id);
    const liveResponse = await fetch(
      `https://api.twitch.tv/helix/streams?${channelIds
        .map((id) => `user_id=${id}`)
        .join("&")}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const liveData = await liveResponse.json();
    const liveStreams = liveData.data;

    // Create channel list
    channelsList.innerHTML = "";
    let liveCount = 0;

    channels.forEach((channel) => {
      const isLive = liveStreams.find(
        (s) => s.user_id === channel.broadcaster_id,
      );
      if (isLive) liveCount++;

      const channelDiv = document.createElement("div");
      channelDiv.className = `channel-item ${isLive ? "live" : ""}`;
      channelDiv.dataset.channel = channel.broadcaster_login;

      let content = `
                <div class="status-indicator ${isLive ? "online" : "offline"}"></div>
                <span class="channel-name">${channel.broadcaster_name}</span>
            `;

      if (isLive) {
        content += `
                    <span class="viewer-count">${isLive.viewer_count.toLocaleString()}</span>
                    <span class="game-name">${isLive.game_name}</span>
                `;
      }

      channelDiv.innerHTML = content;

      // Add click handler to open individual channel in new window
      channelDiv.style.cursor = "pointer";
      channelDiv.addEventListener("click", () => {
        chrome.windows.create({
          url: `https://twitch.tv/${channel.broadcaster_login}`,
          type: "normal",
          state: "maximized",
          focused: true,
        });
      });

      channelsList.appendChild(channelDiv);
    });

    document.getElementById("liveCount").textContent =
      `${liveCount} Live / ${channels.length} Kanäle`;

    // Sort: live channels first
    const sortedChannels = Array.from(channelsList.children).sort((a, b) => {
      const aLive = a.classList.contains("live");
      const bLive = b.classList.contains("live");
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return 0;
    });

    channelsList.innerHTML = "";
    sortedChannels.forEach((channel) => channelsList.appendChild(channel));
  } catch (error) {
    channelsList.innerHTML = `<div class="empty-state">Fehler: ${error.message}</div>`;
  }
}
