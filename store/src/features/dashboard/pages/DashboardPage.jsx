import { usePageTranslation } from "../../language/AdminLanguageProvider";
import { QUICK_ACTIONS, STATS, RECENT_ORDERS, CURATED } from "../constants/dashboardData";
const DashboardPage = () => {
  const {
    t
  } = usePageTranslation();
  return <div className="bg-[#f7f5fb] pb-16 pt-8">
    <div className="mx-auto max-w-6xl px-4">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Column */}
        <section className="space-y-6">
          {/* Welcome Card */}
          <div className="rounded-3xl border border-[#f0cfe0] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#c04b78]">{t("Dashboard")}</p>
                <h1 className="mt-2 text-2xl font-semibold text-[#2a1b2e]">{t("Welcome back, beautiful.")}</h1>
                <p className="mt-2 text-sm text-[#6e3d57]">{t("Manage your orders, rewards, and beauty routine in one place.")}</p>
              </div>
              <div className="rounded-full border border-[#f0cfe0] bg-[#fff7fb] px-4 py-2 text-xs font-semibold text-[#c04b78]">{t("Member since 2024")}</div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {QUICK_ACTIONS.map(action => <button key={action.label} type="button" className={`rounded-full px-4 py-2 text-xs font-semibold transition ${action.tone === "primary" ? "bg-[#c04b78] text-white shadow-sm hover:bg-[#b3416e]" : "border border-[#f0cfe0] bg-white text-[#6e3d57] hover:bg-[#fdf2f7]"}`}>
                  {t(action.label)}
                </button>)}
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {STATS.map(stat => <div key={stat.label} className="rounded-2xl border border-[#f0cfe0] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6e3d57]">
                  {t(stat.label)}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#2a1b2e]">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-[#6e3d57]">{stat.hint}</p>
              </div>)}
          </div>

          {/* Recent Orders */}
          <div className="rounded-3xl border border-[#f0cfe0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#2a1b2e]">{t("Recent orders")}</h2>
            <div className="mt-4 space-y-3">
              {RECENT_ORDERS.map(order => <div key={order.id} className="flex items-center justify-between rounded-2xl border border-[#f0cfe0] bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2a1b2e]">
                      {order.id}
                    </p>
                    <p className="text-xs text-[#6e3d57]">{order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${order.status === "Delivered" ? "text-emerald-600" : "text-[#3b5bb5]"}`}>
                      {order.status}
                    </p>
                    <p className="text-sm font-semibold text-[#2a1b2e]">
                      {order.total}
                    </p>
                  </div>
                </div>)}
            </div>
          </div>
        </section>

        {/* Right Column */}
        <section className="space-y-6">
          {/* Profile Card */}
          <div className="rounded-3xl border border-[#f0cfe0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#2a1b2e]">{t("Your profile")}</h2>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf2f7] text-xl font-semibold text-[#c04b78]">{t("O")}</div>
              <div>
                <p className="text-sm font-semibold text-[#2a1b2e]">{t("OriginsBd Insider")}</p>
                <p className="text-xs text-[#6e3d57]">{t("Skin type: Combination · Preference: Floral")}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#f0cfe0] bg-[#fff7fb] p-4 text-xs text-[#6e3d57]">{t("Next reward unlocks at ৳ 2,000 spend. You are 60% there.")}</div>
          </div>

          {/* Curated */}
          <div className="rounded-3xl border border-[#f0cfe0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#2a1b2e]">{t("Curated for you")}</h2>
            <div className="mt-4 space-y-3">
              {CURATED.map(item => <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-[#f0cfe0] bg-white p-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone}`}>
                    <span className="h-5 w-5 rounded-full bg-white/70" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#2a1b2e]">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#6e3d57]">{item.tag}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#c04b78]">
                    {item.price}
                  </span>
                </div>)}
            </div>
          </div>

          {/* Pro Tip */}
          <div className="rounded-3xl border border-[#f0cfe0] bg-[#fff7fb] p-5 text-sm text-[#6e3d57] shadow-sm">{t("Pro tip: Track orders faster by enabling SMS updates in your profile settings.")}</div>
        </section>
      </div>
    </div>
  </div>;
};
export default DashboardPage;
