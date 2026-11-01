import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import './features/subscription/subscription.css';
import './features/pwa/store-app.css';
import './features/feedback/feedback.css';
import './features/analytics/analytics.css';
import './features/admin/pages/adminPanel.css';
import './components/common/card-reset.css';
import './tailwind.css';
import './index.css';
import './store-themes.css';
import './store-signature-themes.css';
import './store-reference-header.css';







ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
