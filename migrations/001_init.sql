-- ═══════════════════════════════════════════════════════════════
-- ROYAL GOLD BANQUET — Schema (raw MySQL, no ORM)
-- All money DECIMAL(12,2). InnoDB + utf8mb4.
-- ═══════════════════════════════════════════════════════════════
SET NAMES utf8mb4;
SET foreign_key_checks = 0;

DROP TABLE IF EXISTS inquiry_items;
DROP TABLE IF EXISTS inquiries;
DROP TABLE IF EXISTS salary_payments;
DROP TABLE IF EXISTS loan_repayments;
DROP TABLE IF EXISTS employee_loans;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS rules;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS income_adjustments;
DROP TABLE IF EXISTS monthly_locks;
DROP TABLE IF EXISTS manager_disbursements;
DROP TABLE IF EXISTS petty_cash_entries;
DROP TABLE IF EXISTS expense_heads;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_service_items;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS halls;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

SET foreign_key_checks = 1;

-- ── Users ──────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('OWNER','MANAGER','VIEWER') NOT NULL DEFAULT 'VIEWER',
  permissions   JSON NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Halls ──────────────────────────────────────────────
CREATE TABLE halls (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  capacity    INT NOT NULL DEFAULT 0,
  base_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  description VARCHAR(500) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Parties ────────────────────────────────────────────
CREATE TABLE parties (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  party_name VARCHAR(160) NOT NULL,
  bride_name VARCHAR(120) NULL,
  groom_name VARCHAR(120) NULL,
  phone      VARCHAR(40) NULL,
  address    VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Bookings ───────────────────────────────────────────
CREATE TABLE bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  slip_no        VARCHAR(40) NOT NULL UNIQUE,
  party_id       INT NOT NULL,
  hall_id        INT NOT NULL,
  booking_date   DATE NOT NULL,
  event_date     DATE NOT NULL,
  shift          ENUM('LUNCH','DINNER') NOT NULL DEFAULT 'DINNER',
  guest_count    INT NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  banquet_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         ENUM('ENQUIRY','CONFIRMED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  payment_status ENUM('PENDING','PARTIAL','SETTLED') NOT NULL DEFAULT 'PENDING',
  created_by     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_book_party FOREIGN KEY (party_id) REFERENCES parties(id),
  CONSTRAINT fk_book_hall  FOREIGN KEY (hall_id)  REFERENCES halls(id),
  INDEX idx_book_event (event_date),
  INDEX idx_book_booking (booking_date),
  UNIQUE KEY uq_hall_slot (hall_id, event_date, shift)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Booking service items (Banquet Amount itemization) ─
CREATE TABLE booking_service_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  label      VARCHAR(160) NOT NULL,
  qty        DECIMAL(10,2) NOT NULL DEFAULT 1,
  rate       DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal   DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_svc_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Payments (many per booking) ────────────────────────
CREATE TABLE payments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  method       VARCHAR(40) NOT NULL DEFAULT 'CASH',
  received_by  INT NULL,
  note         VARCHAR(255) NULL,
  CONSTRAINT fk_pay_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Expense heads (admin configurable) ─────────────────
CREATE TABLE expense_heads (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  has_qty_note TINYINT(1) NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Petty cash entries ─────────────────────────────────
CREATE TABLE petty_cash_entries (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entry_date      DATE NOT NULL,
  expense_head_id INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  qty_note        VARCHAR(80) NULL,
  booking_id      INT NULL,
  disbursement_id INT NULL,
  entered_by      INT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pc_head FOREIGN KEY (expense_head_id) REFERENCES expense_heads(id),
  INDEX idx_date_head (entry_date, expense_head_id),
  INDEX idx_pc_date (entry_date),
  INDEX idx_pc_disb (disbursement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Manager disbursements (float ledger) ───────────────
CREATE TABLE manager_disbursements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slip_no         VARCHAR(40) NULL,
  booking_id      INT NULL,
  disbursed_by    INT NOT NULL,
  disbursed_to    INT NOT NULL,
  amount_disbursed DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_disbursed  DATE NOT NULL,
  amount_returned DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_returned   DATE NULL,
  status          ENUM('OPEN','RECONCILED','DISPUTED') NOT NULL DEFAULT 'OPEN',
  note            VARCHAR(255) NULL,
  INDEX idx_disb_date (date_disbursed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Monthly locks ──────────────────────────────────────
CREATE TABLE monthly_locks (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  year      INT NOT NULL,
  month     INT NOT NULL,
  locked_by INT NULL,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lock (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Income adjustments (owner-only manual overrides) ───
CREATE TABLE income_adjustments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  year              INT NOT NULL,
  month             INT NOT NULL,
  expense_head_id   INT NOT NULL,
  adjustment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason            VARCHAR(255) NOT NULL,
  made_by           INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adj_head FOREIGN KEY (expense_head_id) REFERENCES expense_heads(id),
  INDEX idx_adj_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Leads (public enquiries) ───────────────────────────
CREATE TABLE leads (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(40) NOT NULL,
  event_date DATE NULL,
  message    VARCHAR(500) NULL,
  source     VARCHAR(40) NOT NULL DEFAULT 'WEBSITE',
  status     ENUM('NEW','CONTACTED','CONVERTED','CLOSED') NOT NULL DEFAULT 'NEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Audit log ──────────────────────────────────────────
CREATE TABLE audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(60) NOT NULL,
  entity_id   VARCHAR(60) NULL,
  before_json JSON NULL,
  after_json  JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity, entity_id),
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Settings (key/value) ───────────────────────────────
CREATE TABLE settings (
  `key`   VARCHAR(80) PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Rules / policies (admin-managed) ───────────────────
CREATE TABLE rules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(1000) NOT NULL,
  category   VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
  sort_order INT NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employees (staff for attendance; not system users) ─
CREATE TABLE employees (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(40) NULL,
  designation VARCHAR(80) NOT NULL DEFAULT 'Staff',
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  joined_date DATE NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Employee loans ─────────────────────────────────────
CREATE TABLE employee_loans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  date_taken  DATE NOT NULL,
  note        VARCHAR(255) NULL,
  is_settled  TINYINT(1) NOT NULL DEFAULT 0,
  created_by  INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_loan_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Loan repayments (via salary deduction or manual) ───
CREATE TABLE loan_repayments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  loan_id           INT NOT NULL,
  employee_id       INT NOT NULL,
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  repay_date        DATE NOT NULL,
  salary_payment_id INT NULL,
  note              VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repay_loan FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE,
  INDEX idx_repay_emp (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Salary payments (monthly disbursement) ─────────────
CREATE TABLE salary_payments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employee_id       INT NOT NULL,
  year              INT NOT NULL,
  month             INT NOT NULL,
  base_salary       DECIMAL(12,2) NOT NULL DEFAULT 0,
  absent_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
  absence_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  loan_deduction    DECIMAL(12,2) NOT NULL DEFAULT 0,
  other_deduction   DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_paid          DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_date         DATE NOT NULL,
  note              VARCHAR(255) NULL,
  paid_by           INT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sal_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sal_period (employee_id, year, month),
  INDEX idx_sal_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Attendance ─────────────────────────────────────────
CREATE TABLE attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  att_date    DATE NOT NULL,
  status      ENUM('PRESENT','ABSENT','LATE','LEAVE') NOT NULL DEFAULT 'PRESENT',
  note        VARCHAR(200) NULL,
  marked_by   INT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_emp_date (employee_id, att_date),
  INDEX idx_att_date (att_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
