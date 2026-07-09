const { BrowserView } = require("electron");

let browserView = null;
let allowedDomains = [];
let currentLayout = {
  top: 132,
  bottom: 34,
  left: 0,
  right: 0,
};
let resizeHandler = null;
let attachedWindow = null;
let browserVisible = false;

function normalizeUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function extractHostname(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAllowed(url) {
  const hostname = extractHostname(url);
  if (!hostname) return false;
  return allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

function isWindowAlive(mainWindow) {
  return !!mainWindow && !mainWindow.isDestroyed() && !!mainWindow.webContents && !mainWindow.webContents.isDestroyed();
}

function hasLiveView() {
  return !!browserView && !!browserView.webContents && !browserView.webContents.isDestroyed();
}

function getBounds(mainWindow) {
  const content = mainWindow.getContentBounds();

  const x = currentLayout.left || 0;
  const y = currentLayout.top || 0;
  const width = Math.max(
    content.width - (currentLayout.left || 0) - (currentLayout.right || 0),
    200
  );
  const height = Math.max(
    content.height - (currentLayout.top || 0) - (currentLayout.bottom || 0),
    200
  );

  return { x, y, width, height };
}

function applyBounds(mainWindow) {
  if (!isWindowAlive(mainWindow)) return false;
  if (!hasLiveView()) return false;
  if (!browserVisible) return false;

  try {
    const bounds = getBounds(mainWindow);
    browserView.setBounds(bounds);
    browserView.setAutoResize({ width: true, height: true });
    return true;
  } catch (e) {
    console.log("applyBounds failed:", e.message);
    return false;
  }
}

function ensureAttached(mainWindow) {
  if (!isWindowAlive(mainWindow)) return false;
  if (!hasLiveView()) return false;

  try {
    if (attachedWindow && attachedWindow !== mainWindow && !attachedWindow.isDestroyed()) {
      try {
        attachedWindow.setBrowserView(null);
      } catch (e) {
        console.log("detach previous window failed:", e.message);
      }
    }

    mainWindow.setBrowserView(browserView);
    attachedWindow = mainWindow;
    browserVisible = true;
    applyBounds(mainWindow);
    return true;
  } catch (e) {
    console.log("ensureAttached failed:", e.message);
    return false;
  }
}

function detachFromWindow(mainWindow) {
  const targetWindow = mainWindow || attachedWindow;
  if (!isWindowAlive(targetWindow)) return false;

  try {
    targetWindow.setBrowserView(null);
    browserVisible = false;
    if (attachedWindow === targetWindow) {
      attachedWindow = null;
    }
    return true;
  } catch (e) {
    console.log("detachFromWindow failed:", e.message);
    return false;
  }
}

function cleanup(mainWindow) {
  try {
    const targetWindow = mainWindow || attachedWindow;
    if (targetWindow && resizeHandler) {
      targetWindow.removeListener("resize", resizeHandler);
    }
  } catch (e) {
    console.log("remove resize handler failed:", e.message);
  }

  resizeHandler = null;

  try {
    const targetWindow = mainWindow || attachedWindow;
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.setBrowserView(null);
    }
  } catch (e) {
    console.log("detach during cleanup failed:", e.message);
  }

  try {
    if (browserView && browserView.webContents && !browserView.webContents.isDestroyed()) {
      browserView.webContents.close();
    }
  } catch (e) {
    console.log("BrowserView close failed:", e.message);
  }

  browserView = null;
  attachedWindow = null;
  browserVisible = false;
}

function wireViewEvents(mainWindow) {
  if (!hasLiveView()) return;

  browserView.webContents.on("will-navigate", (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      console.log("Blocked navigation to", url);
    }
  });

  browserView.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowed(url)) {
      console.log("Blocked popup to", url);
      return { action: "deny" };
    }

    browserView.webContents.loadURL(normalizeUrl(url)).catch((e) => {
      console.log("Popup redirect load failed:", e.message);
    });

    return { action: "deny" };
  });

  browserView.webContents.on("context-menu", (e) => e.preventDefault());

  browserView.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.log("BrowserView failed:", code, desc, url);
  });

  browserView.webContents.on("dom-ready", () => {
    applyBounds(mainWindow);
  });

  browserView.webContents.on("destroyed", () => {
    browserView = null;
    attachedWindow = null;
    browserVisible = false;
  });
}

function createBrowserView(mainWindow, websites = []) {
  if (!isWindowAlive(mainWindow)) return null;

  allowedDomains = (websites || [])
    .map(normalizeUrl)
    .map(extractHostname)
    .filter(Boolean);

  if (hasLiveView()) {
    console.log("Reusing existing BrowserView");
    ensureAttached(mainWindow);
    applyBounds(mainWindow);
    return browserView;
  }

  cleanup(mainWindow);

  try {
    browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
  } catch (e) {
    console.log("BrowserView creation failed:", e.message);
    browserView = null;
    return null;
  }

  wireViewEvents(mainWindow);

  const attached = ensureAttached(mainWindow);
  if (!attached) {
    console.log("BrowserView created but attach failed");
    cleanup(mainWindow);
    return null;
  }

  resizeHandler = () => applyBounds(mainWindow);
  mainWindow.on("resize", resizeHandler);

  applyBounds(mainWindow);

  if (websites.length > 0) {
    const firstUrl = normalizeUrl(websites[0]);
    if (isAllowed(firstUrl)) {
      browserView.webContents.loadURL(firstUrl).catch((e) => {
        console.log("Initial load failed:", e.message);
      });
    } else {
      console.log("Initial URL blocked:", firstUrl);
    }
  } else {
    browserView.webContents.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`
          <html>
            <body style="margin:0;background:#0f1117;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
              <div>No allowed website configured</div>
            </body>
          </html>
        `)
    ).catch((e) => {
      console.log("Empty state load failed:", e.message);
    });
  }

  console.log("BrowserView created successfully");
  return browserView;
}

function navigateTo(url) {
  if (!hasLiveView()) return false;

  const normalized = normalizeUrl(url);
  if (!isAllowed(normalized)) {
    console.log("Blocked manual navigation to", normalized);
    return false;
  }

  try {
    browserView.webContents.loadURL(normalized).catch((e) => {
      console.log("Navigation failed:", e.message);
    });
    return true;
  } catch (e) {
    console.log("navigateTo failed:", e.message);
    return false;
  }
}

function updateBrowserBounds(mainWindow, layout = {}) {
  currentLayout = {
    top: Number.isFinite(layout.top) ? layout.top : currentLayout.top,
    bottom: Number.isFinite(layout.bottom) ? layout.bottom : currentLayout.bottom,
    left: Number.isFinite(layout.left) ? layout.left : currentLayout.left,
    right: Number.isFinite(layout.right) ? layout.right : currentLayout.right,
  };

  return applyBounds(mainWindow);
}

function showBrowser(mainWindow) {
  if (!hasLiveView()) return false;
  return ensureAttached(mainWindow);
}

function hideBrowser(mainWindow) {
  if (!hasLiveView()) return false;
  return detachFromWindow(mainWindow);
}

function focusBrowser(mainWindow) {
  if (!hasLiveView()) return false;
  if (!browserVisible) return false;

  try {
    if (isWindowAlive(mainWindow)) {
      mainWindow.focus();
    }
    browserView.webContents.focus();
    return true;
  } catch (e) {
    console.log("focusBrowser failed:", e.message);
    return false;
  }
}

function restoreBrowser(mainWindow) {
  if (!isWindowAlive(mainWindow)) return false;

  try {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();

    if (!browserVisible) {
      return true;
    }

    applyBounds(mainWindow);
    return true;
  } catch (e) {
    console.log("restoreBrowser failed:", e.message);
    return false;
  }
}

function destroyBrowserView(mainWindow) {
  cleanup(mainWindow);
  allowedDomains = [];
}

module.exports = {
  createBrowserView,
  destroyBrowserView,
  navigateTo,
  updateBrowserBounds,
  showBrowser,
  hideBrowser,
  focusBrowser,
  restoreBrowser,
};