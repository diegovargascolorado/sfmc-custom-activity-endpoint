// app.js - Servidor Node.js para Custom Activity de SFMC (Journey Builder)
// Start: npm start
// Dependencies: express body-parser cors node-fetch

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch"); // ✅ CommonJS estable en Render

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

// ---- Rutas UI y archivos ----

// UI del modal (Render mostrará index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// (Recomendado) Exponer config.json para pruebas rápidas en navegador
app.get("/config.json", (req, res) => {
  res.sendFile(path.join(__dirname, "config.json"));
});

// ---- Rutas requeridas por Journey Builder ----

// Save: cuando el usuario guarda configuración del modal
app.post("/save", (req, res) => {
  console.log("[SFMC] /save:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

// Publish: cuando se publica el Journey
app.post("/publish", (req, res) => {
  console.log("[SFMC] /publish");
  return res.status(200).json({ success: true });
});

// Validate: antes de activar el Journey
app.post("/validate", (req, res) => {
  console.log("[SFMC] /validate:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ success: true });
});

// Stop: cuando se detiene el Journey o se remueve actividad
app.post("/stop", (req, res) => {
  console.log("[SFMC] /stop");
  return res.status(200).json({ success: true });
});

// Execute: se llama cuando un contacto pasa por la actividad
app.post("/execute", async (req, res) => {
  console.log("[SFMC] /execute payload:", JSON.stringify(req.body, null, 2));

  try {
    // 1) Unir inArguments a un solo objeto
    const inArgs = Array.isArray(req.body.inArguments) ? req.body.inArguments : [];
    const contactData = inArgs.reduce((acc, obj) => Object.assign(acc, obj), {});

    // 2) WebhookUrl: normalmente viene en inArguments (desde el modal),
    // pero dejamos fallback a configurationArguments por si acaso
    const configArgs = req.body.configurationArguments || {};
    const webhookUrl =
  (contactData.webhookUrl && String(contactData.webhookUrl).trim()) ||
  (req.body.configurationArguments && req.body.configurationArguments.webhookUrl) ||
  '';

    if (!webhookUrl) {
      console.error("[ERROR] No llegó webhookUrl (ni en inArguments ni en configurationArguments)");
      // Importante: devolver 200 para que el Journey no se rompa (y puedas ver el error)
      return res.status(200).json({ success: false, error: "No webhookUrl configured" });
    }

    // 3) Payload a enviar al webhook externo
    const payload = {
      source: "SalesforceMarketingCloud",
      timestamp: new Date().toISOString(),
      contact: {
        contactKey: contactData.contactKey || "N/A",
        email: contactData.emailAddress || "N/A",
        firstName: contactData.firstName || "N/A"
      },
      journey: {
        name: contactData.journeyName || "N/A"
      }
    };

    console.log("[SFMC] Enviando al webhook:", webhookUrl);
    console.log("[SFMC] Payload:", JSON.stringify(payload, null, 2));

    // 4) POST al webhook
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // timeout manual por si el destino se cuelga
    });

    const statusCode = r.status;
    console.log("[SFMC] Respuesta webhook status:", statusCode);

    // 5) Respuesta obligatoria para que Journey continúe
    return res.status(200).json({ success: true, webhookStatus: statusCode });
  } catch (error) {
    console.error("[ERROR] /execute:", error);
    // Importante: 200 para que Journey no reviente
    return res.status(200).json({ success: true, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listo en puerto ${PORT}`);
  console.log(`   UI:        http://localhost:${PORT}/`);
  console.log(`   Config:    http://localhost:${PORT}/config.json`);
  console.log(`   Execute:   POST http://localhost:${PORT}/execute`);
});
