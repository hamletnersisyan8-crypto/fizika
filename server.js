require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Միացրու միայն այն դեպքում, երբ կայքը վստահելի proxy-ի հետևում է։
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
if (TRUST_PROXY) {
    app.set("trust proxy", 1);
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 ժամ
const lastSent = new Map();

const BOT_WORDS = [
    "bot", "crawl", "spider", "slurp", "curl", "wget", "python-requests"
];

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendVisitorEmail({ ip, userAgent, page }) {
    const time = new Date().toLocaleString("hy-AM", {
        dateStyle: "medium",
        timeStyle: "medium"
    });

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.MAIL_TO,
        subject: "Նոր այցելություն ձեր կայք",
        text:
`Նոր այցելություն կայք։

IP հասցե՝ ${ip}
Ժամանակ՝ ${time}
Էջ՝ ${page}
Բրաուզեր՝ ${userAgent}`
    });
}

function notifyVisitor(req) {
    const userAgent = req.get("user-agent") || "unknown";

    if (BOT_WORDS.some(word => userAgent.toLowerCase().includes(word))) {
        return;
    }

    const ip = req.ip || "unknown";
    const now = Date.now();
    const previous = lastSent.get(ip) || 0;

    if (now - previous < COOLDOWN_MS) {
        return;
    }

    // Գրանցում ենք ուղարկման փորձի ժամանակը՝ կրկնվող նամակները սահմանափակելու համար։
    lastSent.set(ip, now);

    sendVisitorEmail({
        ip,
        userAgent,
        page: req.path
    }).catch(error => {
        console.error("Նամակը չուղարկվեց:", error.message);
    });
}

// Գլխավոր էջ
app.get("/", (req, res) => {
    notifyVisitor(req);
    res.sendFile(path.join(__dirname, "index.html"));
});

// Առանձին կարծիքների էջը, եթե request.html ֆայլը առկա է
app.get("/request.html", (req, res) => {
    res.sendFile(path.join(__dirname, "request.html"), error => {
        if (error && !res.headersSent) {
            res.status(404).send("request.html ֆայլը չի գտնվել։");
        }
    });
});

app.listen(PORT, () => {
    console.log(`Կայքը աշխատում է՝ http://localhost:${PORT}`);
});
