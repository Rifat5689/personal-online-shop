import { usePageTranslation } from "../../language/AdminLanguageProvider";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useMerchantPanel } from "../../../application/providers/MerchantPanelProvider";
import { useSettingsPage } from "../hooks/useSettingsPage";
import { QueryState } from "../../../components/common/QueryState";
import { errorMessage } from "../../../services/api";
import { TbBrandWhatsapp, TbPhotoPlus, TbCrown } from "react-icons/tb";
export function SettingsView({
  platform = false
}) {
  const {
    t
  } = usePageTranslation();
  const hook = useSettingsPage(platform);
  const navigate = useNavigate();
  const { base } = useMerchantPanel();
  const fields = platform ? [["name", "Platform Name"], ["supportEmail", "Support Email"], ["timezone", "Timezone"]] : [["name", "Store Name"], ["description", "Description"], ["supportEmail", "Support Email"], ["whatsappNumber", "WhatsApp Number"]];
  return <>
      <div className="dashboard-header">
        <div>
          <h1>{t(platform ? "Platform" : "Store")}{t(" Settings")}</h1>
          <p>{t("Configure your business information.")}</p>
        </div>
      </div>
      <QueryState query={hook.query}>
        <form className="card form-stack editor" onSubmit={event => {
        event.preventDefault();
        hook.mutation.mutate();
      }}>
          <h2>{t("General Settings")}</h2>
          {!platform && <div className="store-profile-setting">
              {t(hook.form.profileImage?.url ? <img src={hook.form.profileImage.url} alt={t("Current store profile")} /> : <div>
                  <TbPhotoPlus aria-hidden="true" />
                </div>)}
              <label>{t("Store profile image")}<small>{t("JPEG, PNG or WebP, up to 5 MB.")}</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={hook.imageUpload.isPending} onChange={event => {
              const file = event.target.files?.[0];
              if (file) hook.imageUpload.mutate(file);
              event.target.value = "";
            }} />
              </label>
            </div>}
          {fields.map(([field, label]) => <label key={field}>
              {t(label)}
              <input required={field === "name"} type={field === "supportEmail" ? "email" : field === "shippingFee" ? "number" : "text"} min={field === "shippingFee" ? 0 : undefined} step={field === "shippingFee" ? "0.01" : undefined} value={hook.form[field] ?? ""} onChange={event => hook.setForm({
            ...hook.form,
            [field]: event.target.value
          })} />
            </label>)}
          {!platform && <>
              <fieldset className="store-theme-setting" disabled={hook.mutation.isPending || hook.subscription.isPending}>
                <legend>{t("Store theme")}</legend>
                <p>{t("Choose the colors for your storefront. Save changes to apply.")}</p>
                <div className="store-theme-options">
                  {[{
                id: "pink",
                name: "Pink",
                caption: "Original · Default"
              }, {
                id: "green",
                name: "Green",
                caption: "Fresh and natural"
              }, {
                id: "blue",
                name: "Blue",
                caption: "Clean and calm"
              }, {
                id: "midnight",
                name: "Midnight Gold",
                caption: "Navy · Champagne · Ivory"
              }, {
                id: "aurora",
                name: "Aurora",
                caption: "Teal · Violet · Pearl"
              }].map(theme => <label className={`store-theme-option${(hook.form.theme || "pink") === theme.id ? " selected" : ""}`} data-theme-preview={theme.id} key={theme.id} onClick={event => { if (!hook.themeAllowed && !hook.subscription.isPending) { event.preventDefault(); navigate(`${base}/subscription`, { state: { featureDenied: "themes" } }); } }}>
                      <input type="radio" name="store-theme" value={theme.id} checked={(hook.form.theme || "pink") === theme.id} onChange={() => hook.setForm({
                  ...hook.form,
                  theme: theme.id
                })} />
                      <span className="store-theme-preview" aria-hidden="true"><i /><span><b /><b /><b /></span><em /></span>
                      <strong>{theme.name}{!hook.themeAllowed && <span className="theme-pro-badge"><TbCrown aria-hidden="true" /> Pro</span>}</strong><small>{theme.caption}</small>
                    </label>)}
                </div>
              </fieldset>
              <div className="form-grid">
                <label>{t("Inside Dhaka Shipping (BDT)")}<input type="number" min="0" step="0.01" value={hook.form.shippingFees?.insideDhaka ?? ""} onChange={event => hook.setForm({
                ...hook.form,
                shippingFees: {
                  ...hook.form.shippingFees,
                  insideDhaka: event.target.value
                }
              })} />
                </label>
                <label>{t("Outside Dhaka Shipping (BDT)")}<input type="number" min="0" step="0.01" value={hook.form.shippingFees?.outsideDhaka ?? ""} onChange={event => hook.setForm({
                ...hook.form,
                shippingFees: {
                  ...hook.form.shippingFees,
                  outsideDhaka: event.target.value
                }
              })} />
                </label>
              </div>
              <label className="row">
                <input type="checkbox" checked={hook.form.showShippingFees !== false} onChange={event => hook.setForm({
              ...hook.form,
              showShippingFees: event.target.checked
            })} />{t("Show delivery fees and WhatsApp contact on the storefront")}</label>
              {hook.form.whatsappNumber && <p className="muted">
                  <TbBrandWhatsapp aria-hidden="true" />{t("Customers will see this contact number.")}</p>}
            </>}
          {(hook.imageUpload?.isError || hook.imageError) && <p className="error" role="alert">
              {hook.imageError || errorMessage(hook.imageUpload.error)}
            </p>}
          {hook.imageUpload?.isPending && <p role="status">
              <span className="spinner" />{t("Uploading store image...")}</p>}
          {hook.imageUpload?.isSuccess && <p role="status" className="stock-label">{t("Store profile image updated.")}</p>}
          <label>{t("Currency")}<input value="BDT — Bangladeshi Taka" readOnly />
          </label>
          {hook.mutation.isError && <p className="error" role="alert">
              {errorMessage(hook.mutation.error)}
            </p>}
          {hook.saved && <p role="status" className="stock-label">{t("Settings saved.")}</p>}
          <button className="btn-primary" disabled={hook.mutation.isPending}>
            {t(hook.mutation.isPending ? "Saving..." : "Save Changes")}
          </button>
        </form>
      </QueryState>
    </>;
}
