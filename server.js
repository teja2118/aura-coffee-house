require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
const mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(origin => origin.trim())
    : [
        "http://localhost:63342",
        "http://127.0.0.1:63342",
        "http://localhost:3000"
    ];


app.use(cors({
    origin: [
        "http://localhost:63343",
        "http://127.0.0.1:63343",
        "http://localhost:3000"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20kb" }));
app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS time");

        res.json({
            status: "ok",
            database: "connected",
            time: result.rows[0].time
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);

        res.status(500).json({
            status: "error",
            database: "disconnected"
        });
    }
});

app.post("/api/orders", async (req, res) => {
    const { customer_name, customer_email, customer_phone, items } = req.body;

    if (
        typeof customer_name !== "string" ||
        !customer_name.trim() ||
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > 50
    ) {
        return res.status(400).json({
            error: "Valid customer name and order items are required"
        });
    }

    for (const item of items) {
        if (
            typeof item.product_name !== "string" ||
            !item.product_name.trim() ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 100
        ) {
            return res.status(400).json({
                error: "Invalid order item"
            });
        }
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        let total = 0;
        const verifiedItems = [];

        for (const item of items) {
            const result = await client.query(
                `SELECT name, price
                 FROM menu_products
                 WHERE name = $1 AND available = TRUE`,
                [item.product_name.trim()]
            );

            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: `Product unavailable: ${item.product_name}`
                });
            }

            const product = result.rows[0];
            const price = Number(product.price);

            total += price * item.quantity;

            verifiedItems.push({
                name: product.name,
                price,
                quantity: item.quantity
            });
        }

        const orderResult = await client.query(
            `INSERT INTO orders
             (customer_name, customer_email, customer_phone, total_amount)
             VALUES ($1, $2, $3, $4)
             RETURNING id, total_amount, status, created_at`,
            [
                customer_name.trim(),
                typeof customer_email === "string" ? customer_email.trim() || null : null,
                typeof customer_phone === "string" ? customer_phone.trim() || null : null,
                total
            ]
        );

        const order = orderResult.rows[0];

        for (const item of verifiedItems) {
            await client.query(
                `INSERT INTO order_items
                 (order_id, product_name, quantity, unit_price)
                 VALUES ($1, $2, $3, $4)`,
                [order.id, item.name, item.quantity, item.price]
            );
        }

        await client.query("COMMIT");

        try {
            const itemsText = verifiedItems
                .map(item => `${item.name} x ${item.quantity} — ${item.price * item.quantity} MKD`)
                .join("\n");

            await mailer.sendMail({
                from: process.env.EMAIL_USER,
                to: "auracafehouse@gmail.com",
                subject: `Aura Coffee House — Нарачка #${order.id}`,
                text: `Нова нарачка!\n\nБрој: #${order.id}\nКлиент: ${customer_name}\nЕ-пошта: ${customer_email || "Не е внесена"}\nТелефон: ${customer_phone || "Не е внесен"}\n\nПроизводи:\n${itemsText}\n\nВкупно: ${order.total_amount} MKD`
            });
        } catch (emailError) {
            console.error("Email sending failed:", emailError.message);
        }

        return res.status(201).json({
            message: "Order saved successfully",
            order
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Order creation failed:", error.message);

        return res.status(500).json({
            error: "Could not save order"
        });
    } finally {
        client.release();
    }
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "Aura Coffee House API"
    });
});

app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aura API listening on port ${PORT}`);
});