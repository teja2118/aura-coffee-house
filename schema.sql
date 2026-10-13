
CREATE TABLE IF NOT EXISTS orders (
                                      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                      customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(254),
    customer_phone VARCHAR(30),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS order_items (
                                           id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                           order_id BIGINT NOT NULL
                                           REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
    );

CREATE TABLE IF NOT EXISTS reservations (
                                            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                            customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(254),
    customer_phone VARCHAR(30) NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    guests INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 20),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS contact_messages (
                                                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                                customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    subject VARCHAR(150),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_reservations_date
    ON reservations(reservation_date);
