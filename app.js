// app.js - Servidor Node.js para Custom Activity de SFMC
// Ejecutar con: node app.js
// Requiere: npm install express body-parser cors node-fetch

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ---- Rutas requeridas por Journey Builder ----

// Endpoint: publicar la configuración del UI (modal)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint: guardar
app.post('/save', (req, res) => {
  console.log('[SFMC] /save llamado:', JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Endpoint: publicar el journey
app.post('/publish', (req, res) => {
  console.log('[SFMC] /publish llamado');
  res.json({ success: true });
});

// Endpoint: validar antes de activar
app.post('/validate', (req, res) => {
  console.log('[SFMC] /validate llamado');
  res.json({ success: true });
});

// Endpoint: EJECUTAR - este se llama cuando un contacto pasa por la actividad
app.post('/execute', async (req, res) => {
  console.log('[SFMC] /execute llamado con datos:', JSON.stringify(req.body, null, 2));

  try {
    // Extraer datos del contacto desde los inArguments
    const inArgs = req.body.inArguments || [];
    let contactData = {};
    inArgs.forEach(arg => Object.assign(contactData, arg));

    // Obtener la URL del webhook desde configurationArguments
    const configArgs = req.body.configurationArguments || {};
    const webhookUrl = configArgs.webhookUrl;

    if (!webhookUrl) {
      console.error('[ERROR] No se encontró webhookUrl en configurationArguments');
      return res.status(200).json({ success: false, error: 'No webhookUrl configured' });
    }

    // Preparar el payload para enviar al webhook externo
    const payload = {
      source: 'SalesforceMarketingCloud',
      timestamp: new Date().toISOString(),
      contactKey: contactData.contactKey || 'N/A',
      email: contactData.emailAddress || 'N/A',
      firstName: contactData.firstName || 'N/A',
      journeyName: contactData.journeyName || 'N/A'
    };

    console.log('[SFMC] Enviando payload al webhook:', JSON.stringify(payload, null, 2));

    // Enviar al webhook externo (webhook.site u otro)
    const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

    const statusCode = response.status;
    console.log('[SFMC] Respuesta del webhook:', statusCode);

    // SFMC requiere siempre HTTP 200 con success:true para continuar el journey
    res.status(200).json({ success: true, webhookStatus: statusCode });

  } catch (error) {
    console.error('[ERROR] al ejecutar actividad:', error.message);
    res.status(200).json({ success: true, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   - UI disponible en: http://localhost:${PORT}/index.html`);
  console.log(`   - Execute endpoint: POST http://localhost:${PORT}/execute`);
});
