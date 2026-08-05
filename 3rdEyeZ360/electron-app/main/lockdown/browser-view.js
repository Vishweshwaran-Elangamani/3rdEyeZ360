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
  if (!url) {
    return null;
  }

  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function extractHostname(url) {
  try {
    return new URL(normalizeUrl(url))
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

function isAllowed(url) {
  const hostname = extractHostname(url);

  if (!hostname) {
    return false;
  }

  return allowedDomains.some(
    (domain) =>
      hostname === domain ||
      hostname.endsWith(`.${domain}`)
  );
}

function isWindowAlive(mainWindow) {
  return (
    !!mainWindow &&
    !mainWindow.isDestroyed() &&
    !!mainWindow.webContents &&
    !mainWindow.webContents.isDestroyed()
  );
}

function hasLiveView() {
  return (
    !!browserView &&
    !!browserView.webContents &&
    !browserView.webContents.isDestroyed()
  );
}

function getBounds(mainWindow) {
  const content = mainWindow.getContentBounds();

  const x = currentLayout.left || 0;
  const y = currentLayout.top || 0;

  const width = Math.max(
    content.width -
      (currentLayout.left || 0) -
      (currentLayout.right || 0),
    200
  );

  const height = Math.max(
    content.height -
      (currentLayout.top || 0) -
      (currentLayout.bottom || 0),
    200
  );

  return {
    x,
    y,
    width,
    height,
  };
}

function applyBounds(mainWindow) {
  if (!isWindowAlive(mainWindow)) {
    return false;
  }

  if (!hasLiveView()) {
    return false;
  }

  if (!browserVisible) {
    return false;
  }

  try {
    const bounds = getBounds(mainWindow);

    browserView.setBounds(bounds);
    browserView.setAutoResize({
      width: true,
      height: true,
    });

    return true;
  } catch (error) {
    console.log("applyBounds failed:", error.message);
    return false;
  }
}

function ensureAttached(mainWindow) {
  if (!isWindowAlive(mainWindow)) {
    return false;
  }

  if (!hasLiveView()) {
    return false;
  }

  try {
    if (
      attachedWindow &&
      attachedWindow !== mainWindow &&
      !attachedWindow.isDestroyed()
    ) {
      try {
        attachedWindow.setBrowserView(null);
      } catch (error) {
        console.log(
          "Detach from previous window failed:",
          error.message
        );
      }
    }

    mainWindow.setBrowserView(browserView);

    attachedWindow = mainWindow;
    browserVisible = true;

    applyBounds(mainWindow);

    return true;
  } catch (error) {
    console.log("ensureAttached failed:", error.message);
    return false;
  }
}

function detachFromWindow(mainWindow) {
  const targetWindow = mainWindow || attachedWindow;

  if (!isWindowAlive(targetWindow)) {
    browserVisible = false;
    attachedWindow = null;
    return false;
  }

  try {
    targetWindow.setBrowserView(null);

    browserVisible = false;

    if (attachedWindow === targetWindow) {
      attachedWindow = null;
    }

    return true;
  } catch (error) {
    console.log("detachFromWindow failed:", error.message);
    return false;
  }
}

function removeResizeHandler(mainWindow) {
  const targetWindow = mainWindow || attachedWindow;

  if (!resizeHandler) {
    return;
  }

  try {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.removeListener("resize", resizeHandler);
    }
  } catch (error) {
    console.log("Remove resize handler failed:", error.message);
  } finally {
    resizeHandler = null;
  }
}

function cleanup(mainWindow) {
  const targetWindow = mainWindow || attachedWindow;

  /*
   * Save the view locally before clearing the shared reference. This prevents
   * asynchronous destroyed events from acting on a later BrowserView.
   */
  const viewToDestroy = browserView;

  browserView = null;
  browserVisible = false;

  removeResizeHandler(targetWindow);

  try {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.setBrowserView(null);
    }
  } catch (error) {
    console.log("Detach during cleanup failed:", error.message);
  }

  attachedWindow = null;

  try {
    if (
      viewToDestroy &&
      viewToDestroy.webContents &&
      !viewToDestroy.webContents.isDestroyed()
    ) {
      viewToDestroy.webContents.stop();

      /*
       * close() destroys the WebContents belonging to this BrowserView.
       */
      viewToDestroy.webContents.close();
    }
  } catch (error) {
    console.log("BrowserView destruction failed:", error.message);
  }
}

function wireViewEvents(mainWindow, view) {
  if (
    !view ||
    !view.webContents ||
    view.webContents.isDestroyed()
  ) {
    return;
  }

  view.webContents.on("will-navigate", (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      console.log("Blocked navigation to", url);
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowed(url)) {
      console.log("Blocked popup to", url);

      return {
        action: "deny",
      };
    }

    if (
      view.webContents &&
      !view.webContents.isDestroyed()
    ) {
      view.webContents
        .loadURL(normalizeUrl(url))
        .catch((error) => {
          console.log(
            "Popup redirect load failed:",
            error.message
          );
        });
    }

    return {
      action: "deny",
    };
  });

  view.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });

  view.webContents.on(
    "did-fail-load",
    (_event, code, description, url) => {
      console.log(
        "BrowserView failed:",
        code,
        description,
        url
      );
    }
  );

  view.webContents.on("dom-ready", () => {
    /*
     * Apply bounds only if this is still the active BrowserView.
     */
    if (browserView === view) {
      applyBounds(mainWindow);
    }
  });

  view.webContents.on("destroyed", () => {
    /*
     * Do not clear a newly created BrowserView when the destroyed callback
     * belongs to an older view.
     */
    if (browserView === view) {
      browserView = null;
      attachedWindow = null;
      browserVisible = false;
    }
  });
}

function createBrowserView(mainWindow, websites = []) {
  if (!isWindowAlive(mainWindow)) {
    return null;
  }

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
  } catch (error) {
    console.log(
      "BrowserView creation failed:",
      error.message
    );

    browserView = null;
    return null;
  }

  const createdView = browserView;

  wireViewEvents(mainWindow, createdView);

  const attached = ensureAttached(mainWindow);

  if (!attached) {
    console.log("BrowserView created but attach failed");

    cleanup(mainWindow);
    return null;
  }

  resizeHandler = () => {
    if (browserView === createdView) {
      applyBounds(mainWindow);
    }
  };

  mainWindow.on("resize", resizeHandler);

  applyBounds(mainWindow);

  if (websites.length > 0) {
    const firstUrl = normalizeUrl(websites[0]);

    if (isAllowed(firstUrl)) {
      createdView.webContents
        .loadURL(firstUrl)
        .catch((error) => {
          console.log("Initial load failed:", error.message);
        });
    } else {
      console.log("Initial URL blocked:", firstUrl);
    }
  } else {
    createdView.webContents
      .loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(`
            <html>
              <body style="margin:0;background:#0f1117;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div>No allowed website configured</div>
              </body>
            </html>
          `)
      )
      .catch((error) => {
        console.log(
          "Empty state load failed:",
          error.message
        );
      });
  }

  console.log("BrowserView created successfully");

  return createdView;
}

function navigateTo(url) {
  if (!hasLiveView()) {
    return false;
  }

  const normalized = normalizeUrl(url);

  if (!isAllowed(normalized)) {
    console.log(
      "Blocked manual navigation to",
      normalized
    );

    return false;
  }

  try {
    browserView.webContents
      .loadURL(normalized)
      .catch((error) => {
        console.log("Navigation failed:", error.message);
      });

    return true;
  } catch (error) {
    console.log("navigateTo failed:", error.message);
    return false;
  }
}

function updateBrowserBounds(mainWindow, layout = {}) {
  currentLayout = {
    top: Number.isFinite(layout.top)
      ? layout.top
      : currentLayout.top,

    bottom: Number.isFinite(layout.bottom)
      ? layout.bottom
      : currentLayout.bottom,

    left: Number.isFinite(layout.left)
      ? layout.left
      : currentLayout.left,

    right: Number.isFinite(layout.right)
      ? layout.right
      : currentLayout.right,
  };

  return applyBounds(mainWindow);
}

function showBrowser(mainWindow) {
  if (!hasLiveView()) {
    return false;
  }

  return ensureAttached(mainWindow);
}

function hideBrowser(mainWindow) {
  if (!hasLiveView()) {
    return false;
  }

  return detachFromWindow(mainWindow);
}

function focusBrowser(mainWindow) {
  if (!hasLiveView() || !browserVisible) {
    return false;
  }

  try {
    if (isWindowAlive(mainWindow)) {
      mainWindow.focus();
    }

    browserView.webContents.focus();

    return true;
  } catch (error) {
    console.log(
      "focusBrowser failed:",
      error.message
    );

    return false;
  }
}

function restoreBrowser(mainWindow) {
  if (!isWindowAlive(mainWindow)) {
    return false;
  }

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
  } catch (error) {
    console.log(
      "restoreBrowser failed:",
      error.message
    );

    return false;
  }
}

function destroyBrowserView(mainWindow) {
  cleanup(mainWindow);

  allowedDomains = [];

  currentLayout = {
    top: 132,
    bottom: 34,
    left: 0,
    right: 0,
  };

  return true;
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