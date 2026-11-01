import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TbDownload, TbX } from "react-icons/tb";
import { useAdminPwa } from "./AdminPwaProvider";


function InstallInstructions({ ios, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const current = dialog.current;
    current.showModal();
    return () => { current.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="store-app-install-dialog" aria-labelledby={titleId} onCancel={onClose}>
    <header><h2 id={titleId}>Install OwnShop Admin</h2><button type="button" aria-label="Close installation steps" onClick={onClose}><TbX aria-hidden="true" /></button></header>
    <ol>{ios ? <><li>Open this page in Safari.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></> : <><li>Open your browser’s <strong>⋮ menu</strong>.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm <strong>Install</strong>.</li></>}</ol>
    <button type="button" className="btn-primary" onClick={onClose}>Got it</button>
  </dialog>;
}

export default function StoreAppPage() {
  const pwa = useAdminPwa();
  const [showSteps, setShowSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const install = async () => {
    if (!pwa?.canInstall) { setShowSteps(true); return; }
    setInstalling(true);
    try {
      const outcome = await pwa.install();
      if (outcome === "failed" || outcome === "unavailable") setShowSteps(true);
    } finally { setInstalling(false); }
  };
  return <section className="store-app-page">
    <h1>Store App</h1>
    <div className="store-app-card">
      <img className="store-app-icon" src="/admin-app/icons/icon-192.png" alt="" width="80" height="80" />
      <h2>Origins of Beauty Admin</h2>
      {pwa?.installed ? <Link className="btn-primary store-app-install" to="/secure/admin/dashboard">Open Admin App</Link> : <button className="btn-primary store-app-install" type="button" disabled={installing} onClick={install}><TbDownload aria-hidden="true" />{installing ? "Opening…" : "Install Admin App"}</button>}
      {pwa?.installError && <p className="error" role="alert">{pwa.installError}</p>}
    </div>
    {showSteps && <InstallInstructions ios={ios} onClose={() => setShowSteps(false)} />}
  </section>;
}
