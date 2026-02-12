const express = require("express");
const app = express();
app.use(express.json());

// ============================================================
// CONFIGURACIÓN - USA VARIABLES DE ENTORNO
// (las configurarás en Render, no aquí)
// ============================================================
const CONFIG = {
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || "mi_token_secreto_2026",
  MAKE_WEBHOOK_ECHO: process.env.MAKE_WEBHOOK_ECHO || "",
};

// ============================================================
// VERIFICACIÓN DEL WEBHOOK (Meta envía un GET para verificar)
// ============================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === CONFIG.VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }
  console.log("Verificacion fallida");
  return res.sendStatus(403);
});

// ============================================================
// RECEPCIÓN DE WEBHOOKS (Meta envía un POST con eventos)
// ============================================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const field = change.field;
        const value = change.value;

        // Solo procesamos smb_message_echoes (mensajes del usuario)
        if (field === "smb_message_echoes" && value.message_echoes) {
          for (const echo of value.message_echoes) {
            const payload = {
              type: "user_echo",
              from: echo.from,
              to: echo.to,
              message_id: echo.id,
              timestamp: echo.timestamp,
              message_type: echo.type,
              text: echo.text ? echo.text.body : null,
              phone_number_id: value.metadata
                ? value.metadata.phone_number_id
                : null,
            };

            console.log(
              "Usuario respondio a " +
                echo.to +
                ": " +
                (payload.text || "[media]")
            );

            if (CONFIG.MAKE_WEBHOOK_ECHO) {
              await fetch(CONFIG.MAKE_WEBHOOK_ECHO, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }).catch((err) =>
                console.error("Error enviando a Make:", err.message)
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error procesando webhook:", error);
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WhatsApp Middleware activo" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Middleware corriendo en puerto " + PORT);
});
