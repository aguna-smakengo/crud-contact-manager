-- ============================================
-- CATATAN: File ini TIDAK digunakan oleh Docker.
-- Table dibuat otomatis oleh aplikasi Python
-- menggunakan SQLAlchemy (CREATE IF NOT EXISTS).
--
-- File ini hanya sebagai referensi schema.
-- ============================================

-- Schema referensi
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    company VARCHAR(100),
    role VARCHAR(100),
    notes TEXT,
    avatar_color VARCHAR(7) DEFAULT '#6C63FF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
