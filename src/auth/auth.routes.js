// src/auth/auth.routes.js
const express = require('express');
const authService = require('./auth.service');

const router = express.Router();

router.post('/website-register', async (req, res) => {
    const { telefone, email } = req.body;

    if (!telefone || !email) {
        return res.status(400).json({ error: "Phone and email are required for website registration." });
    }

    try {
        const usuario = await authService.registerWebsiteUser(telefone, email);
        res.status(201).json(usuario);
    } catch (error) {
        console.error("Error processing website registration:", error);
        res.status(500).json({ error: "Internal server error during website user registration." });
    }
});

router.post('/whatsapp-register', async (req, res) => {
    const { telefone } = req.body;

    if (!telefone) {
        return res.status(400).json({ error: "Phone is required for WhatsApp registration." });
    }

    try {
        const usuario = await authService.registerWhatsAppUser(telefone);
        res.status(201).json(usuario);
    } catch (error) {
        console.error("Error processing WhatsApp registration:", error);
        res.status(500).json({ error: "Internal server error during WhatsApp user registration." });
    }
});

router.post('/whatsapp-associate-email', async (req, res) => {
    const { telefone, email } = req.body;

    if (!telefone || !email) {
        return res.status(400).json({ error: "Phone and email are required to associate email." });
    }

    try {
        const usuario = await authService.associateEmailWhatsAppUser(telefone, email);
        res.json(usuario);
    } catch (error) {
        console.error("Error processing WhatsApp email association:", error);
        if (error.message === "Usuário não encontrado para associar email.") {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal server error during WhatsApp email association." });
    }
});

router.get('/user-by-phone/:telefone', async (req, res) => {
    const { telefone } = req.params;

    if (!telefone) {
        return res.status(400).json({ error: "Phone number is required." });
    }

    try {
        const userStatus = await authService.getUserByPhone(telefone);
        res.status(200).json(userStatus); // Always return 200 OK
    } catch (error) {
        console.error("Error getting user by phone:", error);
        res.status(500).json({ error: "Internal server error getting user by phone." });
    }
});


module.exports = router;