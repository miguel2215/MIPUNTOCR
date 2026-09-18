/* =========================
   NUBE / SUPABASE AUTH
   Mi Punto CR v7.9
========================= */
const MPCR_SUPABASE_URL = "https://uspycwpztzkenwsevvrp.supabase.co";
const MPCR_SUPABASE_KEY = "sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
const MPCR_SITE_URL = "https://mipuntocr.mieduar2215.workers.dev/";

let mpCloud = null;
let mpCloudSession = null;
let mpCloudUser = null;
let mpCloudBusiness = null;
let mpCloudAuthSubscription = null;

function cloudSdkAvailable() {
  return !!window.supabase?.createClient;
}

function initCloudClient() {
  if (mpCloud) return true;
  if (!cloudSdkAvailable()) return false;
  mpCloud = window.supabase.createClient(MPCR_SUPABASE_URL, MPCR_SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return true;
}

function cloudAuthErrorMessage(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (!msg) return "No se pudo completar la operación.";
  if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("email not confirmed")) return "Primero confirma tu correo electrónico.";
  if (msg.includes("user already registered")) return "Ese correo ya tiene una cuenta. Usa Iniciar sesión.";
  if (msg.includes("password should be")) return "La contraseña no cumple los requisitos de seguridad.";
  if (msg.includes("rate limit") || msg.includes("email rate limit")) return "Espera un momento antes de volver a solicitar el correo.";
  if (msg.includes("fetch") || msg.includes("network")) return "No se pudo conectar con la nube. Revisa Internet.";
  return error?.message || "No se pudo completar la operación.";
}

function cloudBusinessSettingsPayload() {
  return {
    phone: state.settings.phone || "",
    whatsapp: state.settings.whatsapp || "",
    sinpe: state.settings.sinpe || "",
    taxMode: state.settings.taxMode || "added",
    taxRate: Number(state.settings.taxRate ?? 13),
    tableCount: Number(state.settings.tableCount || 0)
  };
}

async function cloudPersistLocalIdentity(user, business) {
  const meta = user?.user_metadata || {};
  const remoteSettings = business?.settings && typeof business.settings === "object" ? business.settings : {};

  state.settings = {
    ...state.settings,
    ...remoteSettings,
    ownerName: meta.full_name || state.settings.ownerName || "",
    businessName: business?.name || meta.business_name || state.settings.businessName || "Mi Punto CR",
    email: user?.email || state.settings.email || "",
    businessType: business?.business_type || meta.business_type || state.settings.businessType || "food",
    accountCreated: true,
    onboardingComplete: true,
    activated: !!user?.email_confirmed_at,
    activationUsed: !!user?.email_confirmed_at,
    pendingCloudConfirmation: false,
    cloudLinked: true,
    cloudUserId: user?.id || "",
    cloudBusinessId: business?.id || "",
    sessionActive: true
  };

  if (!state.settings.businessId || String(state.settings.businessId).startsWith("00000000-")) {
    const short = String(business?.id || "").replace(/-/g, "").slice(0, 10).toUpperCase();
    state.settings.businessId = short ? `MPCR-${short}` : state.settings.businessId;
  }

  await put("settings", state.settings);
}

async function cloudFindOwnedBusiness(userId) {
  if (!mpCloud || !userId) return null;
  const { data, error } = await mpCloud
    .from("businesses")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function cloudCreateBusinessForUser(user) {
  const meta = user?.user_metadata || {};
  const name = String(meta.business_name || state.settings.businessName || "Mi Punto CR").trim() || "Mi Punto CR";
  const businessType = ["food", "products", "services"].includes(meta.business_type)
    ? meta.business_type
    : (state.settings.businessType || "food");

  const payload = {
    name,
    business_type: businessType,
    owner_user_id: user.id,
    active: true,
    settings: cloudBusinessSettingsPayload()
  };

  const { data, error } = await mpCloud
    .from("businesses")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function cloudEnsureBusiness(user) {
  if (!mpCloud || !user) return null;
  let business = await cloudFindOwnedBusiness(user.id);
  if (!business) business = await cloudCreateBusinessForUser(user);
  mpCloudBusiness = business;
  await cloudPersistLocalIdentity(user, business);
  return business;
}

async function cloudHydrateSession(session) {
  mpCloudSession = session || null;
  mpCloudUser = session?.user || null;
  if (!mpCloudUser) return null;
  const business = await cloudEnsureBusiness(mpCloudUser);
  return { user: mpCloudUser, business };
}

async function initCloudAuth() {
  if (!initCloudClient()) return false;

  try {
    const { data, error } = await mpCloud.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      await cloudHydrateSession(data.session);
    } else if (navigator.onLine && state.settings.cloudLinked) {
      state.settings.sessionActive = false;
      await put("settings", state.settings);
    }

    if (!mpCloudAuthSubscription) {
      const { data: listener } = mpCloud.auth.onAuthStateChange(async (event, session) => {
        mpCloudSession = session || null;
        mpCloudUser = session?.user || null;

        if (session?.user && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
          try {
            await cloudHydrateSession(session);
            if (db && !document.querySelector("#modalRoot")) render();
          } catch (error) {
            console.error("Supabase hydrate:", error);
          }
        }

        if (event === "SIGNED_OUT") {
          mpCloudBusiness = null;
        }
      });
      mpCloudAuthSubscription = listener?.subscription || true;
    }

    return true;
  } catch (error) {
    console.error("Supabase init:", error);
    return false;
  }
}

async function cloudRegisterOwner(draft, businessType) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para crear la cuenta.");

  const { data, error } = await mpCloud.auth.signUp({
    email: draft.email,
    password: draft.password,
    options: {
      emailRedirectTo: MPCR_SITE_URL,
      data: {
        full_name: draft.ownerName,
        business_name: draft.businessName,
        business_type: businessType
      }
    }
  });
  if (error) throw error;

  if (data?.session?.user) {
    await cloudHydrateSession(data.session);
  }

  return data;
}

async function cloudLoginOwner(email, password) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para iniciar sesión en un dispositivo nuevo.");

  const { data, error } = await mpCloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data?.session) throw new Error("No se pudo iniciar la sesión.");

  await cloudHydrateSession(data.session);
  return data;
}

async function cloudLogoutOwner() {
  if (!mpCloud && !initCloudClient()) return;
  try {
    await mpCloud.auth.signOut();
  } catch (error) {
    console.error("Supabase signOut:", error);
  }
  mpCloudSession = null;
  mpCloudUser = null;
  mpCloudBusiness = null;
}

async function cloudResendSignup(email) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para reenviar el correo.");
  const { error } = await mpCloud.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: MPCR_SITE_URL }
  });
  if (error) throw error;
}

async function cloudRefreshConfirmedSession() {
  if (!initCloudClient()) return null;
  const { data, error } = await mpCloud.auth.getSession();
  if (error) throw error;
  if (!data?.session) return null;
  await cloudHydrateSession(data.session);
  return data.session;
}

async function cloudSaveBusinessSettings() {
  if (!state.settings.cloudLinked || !state.settings.cloudBusinessId || !mpCloud) return false;
  if (!navigator.onLine) return false;

  const payload = {
    name: state.settings.businessName || "Mi Punto CR",
    business_type: state.settings.businessType || "food",
    settings: cloudBusinessSettingsPayload(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await mpCloud
    .from("businesses")
    .update(payload)
    .eq("id", state.settings.cloudBusinessId)
    .select("*")
    .single();
  if (error) throw error;
  mpCloudBusiness = data;
  return true;
}

async function cloudConnectLegacyBusiness(email, password) {
  const draft = {
    ownerName: state.settings.ownerName || "Propietario",
    businessName: state.settings.businessName || "Mi Punto CR",
    email,
    password
  };
  return cloudRegisterOwner(draft, state.settings.businessType || "food");
}
