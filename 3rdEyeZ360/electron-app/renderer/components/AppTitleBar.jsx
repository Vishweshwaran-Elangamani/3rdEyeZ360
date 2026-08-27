import React from "react";
import appIcon from "../../assets/icons/app-icon (2).png";

export default function AppTitleBar() {
  return (
    <header className="app-titlebar" aria-label="Application title bar">
      <div className="app-titlebar__brand">
        <img
          className="app-titlebar__icon"
          src={appIcon}
          alt=""
          draggable="false"
        />
        <span className="app-titlebar__title">3rdEyeZ360</span>
      </div>
    </header>
  );
}
