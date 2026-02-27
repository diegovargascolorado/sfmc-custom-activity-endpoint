// app.js - Servidor Node.js para Custom Activity de SFMC (Journey Builder)
// Deploy en Render
// Requiere: express, body-parser, cors, node-fetch (v2)

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch"); // node-fetch v2 (CommonJS)

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

/* ===========================
   Helpers
   =========================== */

// Une todos los objetos del array inArguments en un solo objeto
function mergeInArguments(inArgs) {
  const out = {};
  if (Array.isArray(inArgs)) {
    inArgs.forEach((obj) => {
      if (obj && typeof obj === "object") Object.assign(out, obj);
    });
  }
  return out;
}

// Busca webhookUrl en:
// 1) inArguments (lo guardas desde el modal)
// 2) configurationArguments (fallback)
function getWebhookUrl(body) {
  const inArgs = body?.inArguments || body?.arguments?.execute?.inArguments || [];
  const merged = mergeInArguments(inArgs);

  const fromInArgs = merged.webhookUrl ? String(merged.webhookUrl).trim() : "";

  const cfg = body?.configurationArguments || {};
  const fromCfg = cfg.webhookUrl ? String(cfg.webhookUrl).trim() : "";

  return fromInArgs || fromCfg || "";
}

/* ===========================
   Routes (UI + config)
   =========================== */

// UI del modal (index.html)
app.get("/", (req, res) => {
  return res.sendFile(path.join(__dirname, "index.html"));
});

// Exponer config.json (SFMC lo consulta)
app.get("/config.json", (req, res) => {
  return res.sendFile(path.join(__dirname, "config.json"));
});

// Health check (útil para Render)
app.get("/health", (req, res) => {
  return res.status(200).send("OK");
});

/* ===========================
   Journey Builder required endpoints
   =========================== */

// Save: cuando el usuario guarda en el modal
app.post("/save", (req, res) => {
  console.log("[SFMC] /save:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

// Publish: cuando publicas el Journey
app.post("/publish", (req, res) => {
  console.log("[SFMC] /publish:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

// Validate: antes de activar el Journey
app.post("/validate", (req, res) => {
  console.log("[SFMC] /validate:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

// Stop: cuando detienes el Journey o remueves activity
app.post("/stop", (req, res) => {
  console.log("[SFMC] /stop:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

/* ===========================
   Execute: llamado cuando un contacto pasa por la actividad
   =========================== */

app.post("/execute", async (req, res) => {
  console.log("[SFMC] /execute payload:", JSON.stringify(req.body, null, 2));

  try {
    // inArguments pueden venir en req.body.inArguments (algunas pruebas)
    // o en req.body.arguments.execute.inArguments (Journey Builder real)
    const inArgs = req.body?.arguments?.execute?.inArguments || req.body?.inArguments || [];
    const contactData = mergeInArguments(inArgs);

    // Obtener webhookUrl
    const webhookUrl = getWebhookUrl(req.body);

    if (!webhookUrl) {
      console.log("[SFMC] No webhookUrl configured (inArguments/configurationArguments vacíos).");
      // Importante: devolver 200 para que Journey no se rompa
      return res.status(200).json({ success: false, error: "No webhookUrl configured" });
    }

    // Construir payload para el webhook externo
    const payload = {
      source: "SalesforceMarketingCloud",
      timestamp: new Date().toISOString(),
      contact: {
        contactKey: contactData.contactKey || contactData.ContactKey || "N/A",
        email: contactData.emailAddress || contactData.Email || "N/A",
        firstName: contactData.firstName || contactData.FirstName || "N/A"
      },
      journey: {
        name: contactData.journeyName || "N/A"
      }
    };

    console.log("[SFMC] WebhookUrl:", webhookUrl);
    console.log("[SFMC] Payload a enviar:", JSON.stringify(payload, null, 2));

    // Enviar al webhook externo
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const statusCode = response.status;
    console.log("[SFMC] Respuesta webhook status:", statusCode);

    // SFMC: SIEMPRE responder 200 para que el Journey continúe
    return res.status(200).json({ success: true, webhookStatus: statusCode });

  } catch (err) {
    console.error("[ERROR] /execute:", err);
    // NO retornar 500 a SFMC; devolver 200 con error
    return res.status(200).json({ success: true, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port: ${PORT}`);
  console.log(`   UI:        /`);
  console.log(`   Config:    /config.json`);
  console.log(`   Health:    /health`);
  console.log(`   Execute:   POST /execute`);
});
