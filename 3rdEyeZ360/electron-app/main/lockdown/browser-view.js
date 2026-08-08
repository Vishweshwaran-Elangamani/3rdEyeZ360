const { WebContentsView } = require("electron");

let browserView = null;
let allowedDomains = [];
let attachedWindow = null;
let browserVisible = false;
let currentBounds = null;
let windowHandlers = null;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function extractHostname(value) {
  try {
    return new URL(normalizeUrl(value))
      .hostname.replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

function normalizeWebsiteList(websites) {
  const values = Array.isArray(websites) ? websites : [];

  return values
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.url || item?.value || item?.href || null;
    })
    .map(normalizeUrl)
    .filter(Boolean);
}

function isAllowed(value) {
  const hostname = extractHostname(value);
  if (!hostname) return false;

  return allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function isWindowAlive(window) {
  return Boolean(
    window &&
      !window.isDestroyed() &&
      window.webContents &&
      !window.webContents.isDestroyed(),
  );
}

function hasLiveView() {
  return Boolean(
    browserView?.webContents && !browserView.webContents.isDestroyed(),
  );
}

function sanitizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;

  const x = Math.max(0, Math.round(Number(bounds.x) || 0));
  const y = Math.max(0, Math.round(Number(bounds.y) || 0));
  const width = Math.max(1, Math.round(Number(bounds.width) || 0));
  const height = Math.max(1, Math.round(Number(bounds.height) || 0));

  return { x, y, width, height };
}

function boundsFromLayout(mainWindow, layout = {}) {
  if (!isWindowAlive(mainWindow)) return null;

  if (
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y) &&
    Number.isFinite(layout.width) &&
    Number.isFinite(layout.height)
  ) {
    return sanitizeBounds(layout);
  }

  const content = mainWindow.getContentBounds();
  const left = Math.max(0, Number(layout.left) || 0);
  const right = Math.max(0, Number(layout.right) || 0);
  const top = Math.max(0, Number(layout.top) || 0);
  const bottom = Math.max(0, Number(layout.bottom) || 0);

  return sanitizeBounds({
    x: left,
    y: top,
    width: content.width - left - right,
    height: content.height - top - bottom,
  });
}

function applyBounds(mainWindow) {
  if (
    !isWindowAlive(mainWindow) ||
    !hasLiveView() ||
    !browserVisible ||
    !currentBounds
  ) {
    return false;
  }

  try {
    browserView.setBounds(currentBounds);
    return true;
  } catch (error) {
    console.log("Assessment browser bounds failed:", error.message);
    return false;
  }
}

function isAttachedTo(mainWindow) {
  return attachedWindow === mainWindow && browserVisible && hasLiveView();
}

function ensureAttached(mainWindow) {
  if (!isWindowAlive(mainWindow) || !hasLiveView()) return false;

  try {
    if (!isAttachedTo(mainWindow)) {
      if (
        attachedWindow &&
        attachedWindow !== mainWindow &&
        isWindowAlive(attachedWindow)
      ) {
        try {
          attachedWindow.contentView.removeChildView(browserView);
        } catch {
          // The view may already be detached.
        }
      }

      try {
        mainWindow.contentView.addChildView(browserView);
      } catch (error) {
        if (!String(error?.message || "").toLowerCase().includes("already")) {
          throw error;
        }
      }

      attachedWindow = mainWindow;
    }

    browserVisible = true;
    browserView.setVisible(true);
    browserView.webContents.setBackgroundThrottling(false);
    applyBounds(mainWindow);
    return true;
  } catch (error) {
    console.log("Assessment browser attach failed:", error.message);
    return false;
  }
}

function detachFromWindow(mainWindow = attachedWindow) {
  if (!browserView) return false;

  try {
    if (isWindowAlive(mainWindow)) {
      mainWindow.contentView.removeChildView(browserView);
    }
  } catch {
    // The view may already be detached.
  }

  browserVisible = false;
  attachedWindow = null;
  return true;
}

function removeWindowHandlers() {
  if (!windowHandlers) return;

  const { window, handler } = windowHandlers;
  if (isWindowAlive(window)) {
    for (const eventName of ["resize", "maximize", "unmaximize", "restore"]) {
      try {
        window.removeListener(eventName, handler);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  windowHandlers = null;
}

function addWindowHandlers(mainWindow) {
  removeWindowHandlers();

  const handler = () => {
    if (attachedWindow === mainWindow) {
      applyBounds(mainWindow);
    }
  };

  for (const eventName of ["resize", "maximize", "unmaximize", "restore"]) {
    mainWindow.on(eventName, handler);
  }

  windowHandlers = { window: mainWindow, handler };
}

function cleanup(mainWindow = attachedWindow) {
  const oldView = browserView;

  removeWindowHandlers();
  detachFromWindow(mainWindow);

  browserView = null;
  attachedWindow = null;
  browserVisible = false;
  currentBounds = null;

  if (oldView?.webContents && !oldView.webContents.isDestroyed()) {
    try {
      oldView.webContents.stop();
    } catch {
      // Ignore.
    }

    try {
      oldView.webContents.close();
    } catch {
      // Ignore.
    }
  }
}

function sendBrowserState(mainWindow, payload) {
  if (!isWindowAlive(mainWindow)) return;

  try {
    mainWindow.webContents.send("assessment-browser-state", payload);
  } catch (error) {
    console.log("Assessment browser state send failed:", error.message);
  }
}

function buildErrorPage(title, message, url = "") {
  const safeTitle = String(title || "Website unavailable").replace(/[<>]/g, "");
  const safeMessage = String(message || "The allowed website could not be loaded.")
    .replace(/[<>]/g, "");
  const safeUrl = String(url || "").replace(/[<>]/g, "");

  return (
    "data:text/html;charset=utf-8," +
    encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${safeTitle}</title>
        </head>
        <body style="margin:0;background:#0b0e16;color:#eef2ff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;">
          <main style="max-width:620px;padding:32px;text-align:center;">
            <h1 style="font-size:22px;margin:0 0 12px;">${safeTitle}</h1>
            <p style="color:#aeb7d0;line-height:1.6;margin:0 0 14px;">${safeMessage}</p>
            <p style="color:#7280a3;font-size:12px;word-break:break-all;margin:0;">${safeUrl}</p>
          </main>
        </body>
      </html>
    `)
  );
}

async function showErrorPage(view, title, message, url) {
  if (view !== browserView || !hasLiveView()) return;

  try {
    await view.webContents.loadURL(buildErrorPage(title, message, url));
  } catch (error) {
    console.log("Assessment browser error page failed:", error.message);
  }
}

function wireViewEvents(mainWindow, view) {
  const contents = view.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) {
      void loadUrl(view, url, mainWindow);
    } else {
      console.log("Blocked assessment popup:", url);
    }
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (!isAllowed(url) && !url.startsWith("data:text/html")) {
      event.preventDefault();
      console.log("Blocked assessment navigation:", url);
    }
  });

  contents.on("will-redirect", (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      console.log("Blocked assessment redirect:", url);
      sendBrowserState(mainWindow, {
        status: "blocked",
        url,
        error: "The website redirected to a domain that is not allowed.",
      });
    }
  });

  contents.on("did-start-loading", () => {
    sendBrowserState(mainWindow, {
      status: "loading",
      url: contents.getURL(),
    });
  });

  contents.on("did-finish-load", () => {
    const url = contents.getURL();
    console.log("Assessment browser loaded:", url);

    if (browserView === view) {
      ensureAttached(mainWindow);
      applyBounds(mainWindow);
    }

    sendBrowserState(mainWindow, {
      status: "loaded",
      url,
      title: contents.getTitle(),
    });
  });

  contents.on(
    "did-fail-load",
    (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return;

      console.log("Assessment browser failed:", code, description, url);
      sendBrowserState(mainWindow, {
        status: "failed",
        url,
        code,
        error: description || "The allowed website could not be loaded.",
      });

      void showErrorPage(
        view,
        "Website could not be loaded",
        `${description || "Unknown load error"} (${code})`,
        url,
      );
    },
  );

  contents.on("render-process-gone", (_event, details) => {
    console.log(
      "Assessment browser renderer exited:",
      details?.reason,
      details?.exitCode,
    );

    sendBrowserState(mainWindow, {
      status: "failed",
      error: `Website renderer exited: ${details?.reason || "unknown"}`,
    });
  });

  contents.on("context-menu", (event) => event.preventDefault());
}

async function loadUrl(view, value, mainWindow = attachedWindow) {
  const url = normalizeUrl(value);

  if (!url || !isAllowed(url) || view !== browserView || !hasLiveView()) {
    return false;
  }

  try {
    view.webContents.setUserAgent(USER_AGENT);
    sendBrowserState(mainWindow, { status: "loading", url });
    await view.webContents.loadURL(url, { userAgent: USER_AGENT });
    ensureAttached(mainWindow);
    applyBounds(mainWindow);
    return true;
  } catch (error) {
    if (
      Number(error?.errno) === -3 ||
      String(error?.message || "").includes("ERR_ABORTED")
    ) {
      return true;
    }

    console.log("Assessment browser load error:", error?.message || error);
    sendBrowserState(mainWindow, {
      status: "failed",
      url,
      error: error?.message || "The allowed website could not be loaded.",
    });

    await showErrorPage(
      view,
      "Website could not be loaded",
      error?.message || "Unknown load error",
      url,
    );
    return false;
  }
}

async function createBrowserView(mainWindow, websites = [], initialBounds = null) {
  if (!isWindowAlive(mainWindow)) return null;

  const normalizedWebsites = normalizeWebsiteList(websites);
  allowedDomains = [
    ...new Set(normalizedWebsites.map(extractHostname).filter(Boolean)),
  ];

  if (hasLiveView()) {
    cleanup(mainWindow);
  }

  currentBounds = boundsFromLayout(mainWindow, initialBounds || {}) || {
    x: 0,
    y: 64,
    width: Math.max(mainWindow.getContentBounds().width - 340, 1),
    height: Math.max(mainWindow.getContentBounds().height - 64, 1),
  };

  try {
    browserView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: "persist:assessment-browser",
        webSecurity: true,
        backgroundThrottling: false,
      },
    });

    browserView.setBackgroundColor("#ffffff");
    browserView.webContents.setUserAgent(USER_AGENT);
    wireViewEvents(mainWindow, browserView);

    if (!ensureAttached(mainWindow)) {
      throw new Error("Unable to attach WebContentsView");
    }

    addWindowHandlers(mainWindow);
    applyBounds(mainWindow);

    if (normalizedWebsites[0]) {
      await loadUrl(browserView, normalizedWebsites[0], mainWindow);
    } else {
      await showErrorPage(
        browserView,
        "No allowed website configured",
        "The assessment does not contain an allowed website.",
        "",
      );
    }

    console.log("Assessment WebContentsView created", {
      websites: normalizedWebsites,
      bounds: currentBounds,
    });

    return browserView;
  } catch (error) {
    console.log("Assessment browser creation failed:", error.message);
    sendBrowserState(mainWindow, {
      status: "failed",
      error: error.message || "Failed to create assessment browser.",
    });
    cleanup(mainWindow);
    return null;
  }
}

function destroyBrowserView(mainWindow) {
  cleanup(mainWindow);
  allowedDomains = [];
  return true;
}

async function navigateTo(url) {
  if (!hasLiveView() || !isAllowed(url)) return false;
  return loadUrl(browserView, url, attachedWindow);
}

function updateBrowserBounds(mainWindow, layout = {}) {
  const nextBounds = boundsFromLayout(mainWindow, layout);
  if (!nextBounds) return false;

  currentBounds = nextBounds;
  return applyBounds(mainWindow);
}

function showBrowser(mainWindow) {
  if (!hasLiveView()) return false;

  const attached = ensureAttached(mainWindow);
  if (attached) {
    browserView.setVisible(true);
    browserVisible = true;
    applyBounds(mainWindow);
  }
  return attached;
}

function hideBrowser(mainWindow) {
  if (!hasLiveView()) return false;

  try {
    browserView.setVisible(false);
  } catch {
    // Ignore.
  }

  browserVisible = false;
  return detachFromWindow(mainWindow);
}

function focusBrowser(mainWindow) {
  if (!hasLiveView() || !browserVisible) return false;

  try {
    mainWindow?.focus?.();
    browserView.webContents.focus();
    return true;
  } catch {
    return false;
  }
}

function restoreBrowser(mainWindow) {
  if (!isWindowAlive(mainWindow)) return false;

  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();

    if (hasLiveView()) {
      showBrowser(mainWindow);
      applyBounds(mainWindow);
    }

    return true;
  } catch {
    return false;
  }
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
