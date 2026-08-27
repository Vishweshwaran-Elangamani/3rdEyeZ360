import React, { useEffect, useMemo, useState } from "react";

const TOTAL_DURATION = 4000;
const BLACK_TEXT_DURATION = 500;
const FRAME_DURATION = 250;
const EXIT_DURATION = 450;

const importedSplashImages = import.meta.glob(
  "../../assets/splash/*.{jpg,jpeg,png,webp}",
  {
    eager: true,
    import: "default",
  }
);

const SPLASH_IMAGES = Object.entries(importedSplashImages)
  .sort(([pathA], [pathB]) =>
    pathA.localeCompare(pathB, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  )
  .map(([, imageUrl]) => imageUrl);

export default function StartupSplash({ onFinish }) {
  const [elapsed, setElapsed] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.windowTheme = "splash";
    window.electronAPI?.setTitleBarTheme?.("splash");

    SPLASH_IMAGES.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    const startedAt = performance.now();

    const frameTimer = window.setInterval(() => {
      const nextElapsed = performance.now() - startedAt;
      setElapsed(Math.min(nextElapsed, TOTAL_DURATION));
    }, 50);

    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, TOTAL_DURATION - EXIT_DURATION);

    const finishTimer = window.setTimeout(() => {
      // Switch the title-bar background, native symbols, and application page
      // together in the same event-loop tick.
      document.documentElement.dataset.windowTheme = "app";
      window.electronAPI?.setTitleBarTheme?.("app");
      onFinish?.();
    }, TOTAL_DURATION);

    return () => {
      window.clearInterval(frameTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const currentImage = useMemo(() => {
    if (elapsed < BLACK_TEXT_DURATION || SPLASH_IMAGES.length === 0) {
      return null;
    }

    const frameIndex = Math.floor(
      (elapsed - BLACK_TEXT_DURATION) / FRAME_DURATION
    );

    return SPLASH_IMAGES[frameIndex % SPLASH_IMAGES.length];
  }, [elapsed]);

  const progress = Math.min((elapsed / TOTAL_DURATION) * 100, 100);
  const isImageVisible = Boolean(currentImage);

  return (
    <div
      className={`startup-splash ${isExiting ? "startup-splash--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="3rdEyeZ360 is starting"
    >
      <style>{`
        .startup-splash {
          position: fixed;
          inset: 0;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #ffffff;
          opacity: 1;
          transform: scale(1);
          transition:
            opacity ${EXIT_DURATION}ms ease,
            transform ${EXIT_DURATION}ms ease;
        }

        .startup-splash--exit {
          opacity: 0;
          transform: scale(1.025);
          pointer-events: none;
        }

        .startup-splash__content {
          width: 100%;
          padding: 0 2vw;
          box-sizing: border-box;
        }

        .startup-splash__wordmark {
          width: 100%;
          margin: 0;
          color: #050505;
          font-family: "Arial Black", "Inter", "Segoe UI", sans-serif;
          font-size: clamp(58px, 12.3vw, 230px);
          font-weight: 900;
          line-height: 0.9;
          letter-spacing: -0.075em;
          text-align: center;
          white-space: nowrap;
          user-select: none;
          transform: translateZ(0);
        }

        .startup-splash__wordmark--masked {
          color: transparent;
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: saturate(1.12) contrast(1.1);
        }

        .startup-splash__progress {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          height: 3px;
          overflow: hidden;
          background: #ededed;
        }

        .startup-splash__progress-value {
          height: 100%;
          background: #050505;
          transition: width 50ms linear;
        }

        @media (max-width: 900px) {
          .startup-splash__wordmark {
            font-size: clamp(48px, 11.5vw, 120px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .startup-splash,
          .startup-splash__progress-value {
            transition: none;
          }
        }
      `}</style>

      <div className="startup-splash__content">
        <h1
          className={`startup-splash__wordmark ${
            isImageVisible ? "startup-splash__wordmark--masked" : ""
          }`}
          style={
            isImageVisible
              ? { backgroundImage: `url("${currentImage}")` }
              : undefined
          }
        >
          3rdEyeZ360
        </h1>
      </div>

      <div className="startup-splash__progress" aria-hidden="true">
        <div
          className="startup-splash__progress-value"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
