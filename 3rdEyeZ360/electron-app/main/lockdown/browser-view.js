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
  return allowedDomains.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );
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
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!browserView || browserView.webContents.isDestroyed()) return;

  const bounds = getBounds(mainWindow);
  browserView.setBounds(bounds);
  browserView.setAutoResize({ width: true, height: true });
}

function cleanup(mainWindow) {
  if (!browserView) return;

  try {
    if (mainWindow && resizeHandler) {
      mainWindow.removeListener("resize", resizeHandler);
      resizeHandler = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBrowserView(null);
    }

    if (!browserView.webContents.isDestroyed()) {
      browserView.webContents.destroy();
    }
  } catch (e) {
    console.log("BrowserView cleanup failed:", e.message);
  }

  browserView = null;
}

function createBrowserView(mainWindow, websites = []) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  cleanup(mainWindow);

  allowedDomains = (websites || [])
    .map(normalizeUrl)
    .map(extractHostname)
    .filter(Boolean);

  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.setBrowserView(browserView);

  resizeHandler = () => applyBounds(mainWindow);
  mainWindow.on("resize", resizeHandler);

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

    browserView.webContents.loadURL(normalizeUrl(url));
    return { action: "deny" };
  });

  browserView.webContents.on("context-menu", (e) => e.preventDefault());

  browserView.webContents.on("did-fail-load", (_, code, desc, url) => {
    console.log("BrowserView failed:", code, desc, url);
  });

  browserView.webContents.on("dom-ready", () => {
    applyBounds(mainWindow);
  });

  applyBounds(mainWindow);

  if (websites.length > 0) {
    const firstUrl = normalizeUrl(websites[0]);
    browserView.webContents.loadURL(firstUrl).catch((e) => {
      console.log("Initial load failed:", e.message);
    });
  } else {
    browserView.webContents.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`
          <html>
            <body style="margin:0;background:#0f1117;color:#fff;font-family:Arial, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
              <div>No allowed website configured</div>
            </body>
          </html>
        `)
    );
  }

  return browserView;
}

function navigateTo(url) {
  if (!browserView || browserView.webContents.isDestroyed()) return;
  const normalized = normalizeUrl(url);

  if (!isAllowed(normalized)) {
    console.log("Blocked manual navigation to", normalized);
    return;
  }

  browserView.webContents.loadURL(normalized).catch((e) => {
    console.log("Navigation failed:", e.message);
  });
}

function updateBrowserBounds(mainWindow, layout = {}) {
  currentLayout = {
    top: Number.isFinite(layout.top) ? layout.top : currentLayout.top,
    bottom: Number.isFinite(layout.bottom) ? layout.bottom : currentLayout.bottom,
    left: Number.isFinite(layout.left) ? layout.left : currentLayout.left,
    right: Number.isFinite(layout.right) ? layout.right : currentLayout.right,
  };

  applyBounds(mainWindow);
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
};