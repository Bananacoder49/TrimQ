-- ==========================================================
-- TrimQ database schema (MySQL)
-- XAMPP: start MySQL in the XAMPP Control Panel, open phpMyAdmin
-- (http://localhost/phpmyadmin), click the "Import" tab and choose this file.
-- Or from a terminal:  mysql -u root -p < schema.sql
-- ==========================================================

CREATE DATABASE IF NOT EXISTS trimq;
USE trimq;

-- ---------- Accounts (matches your existing table) ----------
-- Passwords are stored as bcrypt hashes by the server, never as plain text.
CREATE TABLE IF NOT EXISTS account (
  Account_ID INT(11)      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  User_Name  VARCHAR(50)  NOT NULL,
  Password   VARCHAR(255) NOT NULL,
  Email      VARCHAR(100) NOT NULL,
  Role       VARCHAR(20)  NOT NULL,
  UNIQUE KEY User_Name (User_Name),
  UNIQUE KEY Email (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Table for accounts of the website.';

-- ---------- Walk-in queue ----------
CREATE TABLE IF NOT EXISTS queue (
  id         INT AUTO_INCREMENT PRIMARY KEY,                        -- the queue number
  name       VARCHAR(80)  NOT NULL,
  service    VARCHAR(60)  NOT NULL,
  status     ENUM('waiting', 'serving', 'done') NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Appointments ----------
CREATE TABLE IF NOT EXISTS appointments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL,
  service    VARCHAR(60)  NOT NULL,
  appt_date  DATE         NOT NULL,                                 -- e.g. 2026-11-03
  appt_time  SMALLINT     NOT NULL,                                 -- minutes after midnight (570 = 9:30 AM)
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_booking_per_slot (appt_date, appt_time)            -- prevents double booking
);
