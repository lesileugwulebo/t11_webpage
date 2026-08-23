// ==============================================================================
// Microsoft Entra ID (Azure Active Directory) MSAL.js Authentication Helper
// ==============================================================================

const ENTRA_CONFIG = {
  clientId: window.ENTRA_CLIENT_ID || "00000000-0000-0000-0000-000000000000",
  tenantId: window.ENTRA_TENANT_ID || "common",
  redirectUri: window.location.origin
};

let msalInstance = null;
try {
  if (window.msal && ENTRA_CONFIG.clientId !== "00000000-0000-0000-0000-000000000000") {
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: ENTRA_CONFIG.clientId,
        authority: `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}`,
        redirectUri: ENTRA_CONFIG.redirectUri
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
      }
    });
  }
} catch (e) {
  console.warn("MSAL initialization note:", e);
}

/**
 * Handle Microsoft Entra ID Sign-In
 * @param {string} defaultRole - 'user' or 'admin' depending on portal
 * @param {function} onSuccess - Callback with user and token
 * @param {function} onError - Error callback
 */
async function loginWithMicrosoftEntra(defaultRole = 'user', onSuccess, onError) {
  // If MSAL is fully configured with real Azure tenant
  if (msalInstance) {
    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: ["openid", "profile", "email", "User.Read"]
      });
      const account = loginResponse.account;
      const roles = account.idTokenClaims?.roles || [];
      const role = roles.includes("Inventory.Admin") ? "admin" : defaultRole;

      const res = await window.api.loginEntraSSO({
        idToken: loginResponse.idToken,
        email: account.username,
        name: account.name,
        role: role
      });

      if (onSuccess) onSuccess(res);
    } catch (err) {
      console.error("Microsoft Entra ID Login Error:", err);
      if (onError) onError(err.message || "Failed to sign in with Microsoft Entra ID");
    }
    return;
  }

  // Interactive Quick Connect / Demo Entra ID SSO Flow
  const emailPrompt = prompt(
    "🔑 Microsoft Entra ID Single Sign-On:\nEnter your corporate Microsoft 365 email:",
    defaultRole === 'admin' ? "admin@verdadsolutions.com" : "operator@verdadsolutions.com"
  );

  if (!emailPrompt) return;

  const nameGuess = emailPrompt.split("@")[0].replace(".", " ").replace("_", " ");
  const formattedName = nameGuess.charAt(0).toUpperCase() + nameGuess.slice(1);

  try {
    const res = await window.api.loginEntraSSO({
      email: emailPrompt,
      name: formattedName,
      role: defaultRole
    });
    if (onSuccess) onSuccess(res);
  } catch (err) {
    if (onError) onError(err.message);
  }
}

window.entraAuth = {
  loginWithMicrosoftEntra,
  config: ENTRA_CONFIG
};
