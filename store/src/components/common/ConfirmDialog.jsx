import { usePageTranslation } from "../../features/language/AdminLanguageProvider";
import React, { useEffect, useId, useRef, useState } from "react";
import { TbTrash, TbX } from "react-icons/tb";
function ConfirmDialog({ config, onClose }) {
  const { t } = usePageTranslation();
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="destructive-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="destructive-dialog-content">
        <button
          type="button"
          className="destructive-dialog-close"
          aria-label={t("Close confirmation")}
          onClick={onClose}
        >
          <TbX />
        </button>
        <span className="destructive-dialog-icon">
          <TbTrash aria-hidden="true" />
        </span>
        <h2 id={titleId}>{t(config.title)}</h2>
        <p id={descriptionId}>{t(config.message)}</p>
        <div className="destructive-dialog-actions">
          <button type="button" autoFocus onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="destructive-dialog-confirm"
            onClick={() => {
              onClose();
              config.onConfirm();
            }}
          >
            {t(config.confirmLabel || "Delete")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
export function useConfirmDialog() {
  const [config, setConfig] = useState(null);
  return {
    confirm: setConfig,
    confirmationDialog: config ? (
      <ConfirmDialog config={config} onClose={() => setConfig(null)} />
    ) : null,
  };
}
