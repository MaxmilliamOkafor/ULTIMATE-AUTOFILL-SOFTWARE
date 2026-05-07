// === SPEEDYAPPLY PREMIUM UNLOCK (loaded by options.html / popup.html / sidepanel.html) ===
// Runs BEFORE the bundled extension scripts so the fetch / XHR overrides catch the
// very first subscription / billing API call. Also seeds chrome.storage.local with
// active-premium flags so SpeedyApply's UI treats the user as Premium for
// Multiple Profiles, Smart Profile Scoring, and Generated Responses with
// no expiry, no trial, no checkout.
(function () {
  'use strict';
  if (window.__saPremiumUnlocked) return;
  window.__saPremiumUnlocked = true;

  const FAR_FUTURE = '2126-12-31T23:59:59.000Z';
  const NOW = new Date().toISOString();
  const PREMIUM_SUB = {
    id: 'sa-ultimate-unlocked',
    user_id: 'sa-ultimate',
    status: 'active',
    plan: 'premium',
    tier: 'premium',
    interval: 'weekly',
    is_premium: true,
    premium: true,
    cancel_at_period_end: false,
    cancelled_at: null,
    canceled_at: null,
    trial_end: FAR_FUTURE,
    current_period_start: NOW,
    current_period_end: FAR_FUTURE,
    expires_at: FAR_FUTURE,
    created_at: NOW,
    updated_at: NOW,
    stripe_customer_id: 'cus_sa_ultimate',
    stripe_subscription_id: 'sub_sa_ultimate',
    metadata: { source: 'sa-ultimate' },
  };

  // ---- Seed chrome.storage.local with premium flags ----
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(null, cur => {
        const accountSettings = (typeof cur.accountSettings === 'string'
          ? (() => { try { return JSON.parse(cur.accountSettings); } catch (_) { return {}; } })()
          : (cur.accountSettings || {}));
        const newAccount = { ...accountSettings, premium: true, isPremium: true, hasPremium: true, tier: 'premium', plan: 'premium', subscription_status: 'active', subscriptionStatus: 'active', trial_end: FAR_FUTURE, expiresAt: FAR_FUTURE };
        chrome.storage.local.set({
          premium: true,
          isPremium: true,
          hasPremium: true,
          subscription: PREMIUM_SUB,
          subscriptionStatus: 'active',
          subscription_status: 'active',
          plan: 'premium',
          tier: 'premium',
          accountTier: 'premium',
          premiumSettings: { enabled: true, multipleProfiles: true, smartScoring: true, generatedResponses: true, jobScoring: true, profileList: true, responseFeedback: true },
          premiumAutofill: true,
          premiumFetchProfileList: true,
          premiumFetchJobScores: true,
          premiumResponseFeedback: true,
          accountSettings: typeof cur.accountSettings === 'string' ? JSON.stringify(newAccount) : newAccount,
        });
      });
    }
  } catch (_) { }

  // ---- Intercept fetch ----
  try {
    const _fetch = window.fetch;
    window.fetch = async function () {
      const u = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0]?.url || '');
      try {
        // Supabase REST: subscriptions table — return active premium row.
        if (/\/rest\/v1\/subscriptions/i.test(u)) {
          // PostgREST honours `Prefer: return=representation` + `Accept: application/vnd.pgrst.object+json`.
          // Match either array or single-object response style.
          const headers = (typeof arguments[1] === 'object' && arguments[1]?.headers) || {};
          const acceptHdr = (headers.Accept || headers.accept || (headers.get && headers.get('Accept')) || '');
          const isSingle = /pgrst\.object/i.test(acceptHdr);
          const body = isSingle ? PREMIUM_SUB : [PREMIUM_SUB];
          return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Supabase REST: profiles — enrich with premium flags without breaking shape.
        if (/\/rest\/v1\/profiles/i.test(u)) {
          const r = await _fetch.apply(window, arguments).catch(() => null);
          if (r && r.ok) {
            try {
              const body = await r.clone().json();
              const enrich = row => ({ ...(row || {}), is_premium: true, premium: true, tier: 'premium', plan: 'premium', subscription_status: 'active' });
              const out = Array.isArray(body) ? body.map(enrich) : enrich(body);
              return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (_) { return r; }
          }
        }
        // Generic premium / billing / checkout / paywall / trial / entitlement endpoints.
        if (/\/(premium|billing|checkout|paywall|subscribe|trial|entitlement|plan)\b/i.test(u) ||
            /speedyapply\.com\/api/i.test(u)) {
          const okBody = { success: true, active: true, premium: true, isPremium: true, tier: 'premium', plan: 'premium', status: 'active', subscription: PREMIUM_SUB, expiresAt: FAR_FUTURE, features: { multipleProfiles: true, smartScoring: true, generatedResponses: true } };
          return new Response(JSON.stringify(okBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        // Pass-through; rewrite 402/403/429 to 200 success in case of premium gate.
        const r = await _fetch.apply(window, arguments);
        if (r.status === 402 || r.status === 403 || r.status === 429) {
          return new Response(JSON.stringify({ success: true, active: true, premium: true, isPremium: true, tier: 'premium', status: 'active', expiresAt: FAR_FUTURE }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return r;
      } catch (_) { return _fetch.apply(window, arguments); }
    };
  } catch (_) { }

  // ---- Intercept XMLHttpRequest ----
  try {
    const _xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) { this._sa_url = url || ''; return _xhrOpen.apply(this, arguments); };
    const _xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      const url = this._sa_url || '';
      if (/\/rest\/v1\/subscriptions/i.test(url) || /\/(premium|billing|checkout|paywall|subscribe|trial|entitlement|plan)\b/i.test(url)) {
        const s = this;
        const body = JSON.stringify(/\/rest\/v1\/subscriptions/i.test(url) ? [PREMIUM_SUB] : { success: true, active: true, premium: true, isPremium: true, tier: 'premium', status: 'active', subscription: PREMIUM_SUB, expiresAt: FAR_FUTURE });
        Object.defineProperty(s, 'responseText', { configurable: true, get: () => body });
        Object.defineProperty(s, 'response', { configurable: true, get: () => body });
        Object.defineProperty(s, 'status', { configurable: true, get: () => 200 });
        Object.defineProperty(s, 'readyState', { configurable: true, get: () => 4 });
        setTimeout(() => { try { s.onreadystatechange?.(); s.onload?.(); } catch (_) { } }, 30);
        return;
      }
      return _xhrSend.apply(this, arguments);
    };
  } catch (_) { }

  console.log('[SA Premium Unlock] active — unlimited Premium, never expires');
})();
