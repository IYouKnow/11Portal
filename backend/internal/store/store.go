package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/portal/backend/internal/auth"
	"github.com/portal/backend/internal/config"
)

type Store struct {
	db *sql.DB
}

type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type Workspace struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type Session struct {
	Token     string
	UserID    int64
	ExpiresAt time.Time
}

type CreateUserInput struct {
	Email    string
	Password string
	Role     string
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Initialize(cfg config.Config) error {
	if err := s.migrate(); err != nil {
		return err
	}

	if err := s.ensureAdmin(cfg.AdminEmail, cfg.AdminPassword); err != nil {
		return err
	}

	if err := s.seedDefaultWorkspaces(); err != nil {
		return err
	}

	return nil
}

func (s *Store) migrate() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			role TEXT NOT NULL DEFAULT 'user',
			password_hash TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS workspaces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'ready',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, statement := range statements {
		if _, err := s.db.Exec(statement); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	if _, err := s.db.Exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add user role: %w", err)
	}

	if _, err := s.db.Exec(`UPDATE users SET role = 'user' WHERE role IS NULL OR TRIM(role) = ''`); err != nil {
		return fmt.Errorf("migrate backfill user role: %w", err)
	}

	return nil
}

func (s *Store) ensureAdmin(email, password string) error {
	var existingID int64
	err := s.db.QueryRow(`SELECT id FROM users WHERE email = ? LIMIT 1`, email).Scan(&existingID)
	if err == nil {
		if _, updateErr := s.db.Exec(`UPDATE users SET role = 'admin' WHERE id = ?`, existingID); updateErr != nil {
			return fmt.Errorf("promote admin: %w", updateErr)
		}
		return nil
	}

	if err != sql.ErrNoRows {
		return fmt.Errorf("check admin: %w", err)
	}

	hashed, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hash admin password: %w", err)
	}

	if _, err := s.db.Exec(
		`INSERT INTO users (email, role, password_hash) VALUES (?, 'admin', ?)`,
		email,
		hashed,
	); err != nil {
		return fmt.Errorf("insert admin: %w", err)
	}

	return nil
}

func (s *Store) seedDefaultWorkspaces() error {
	items := []Workspace{
		{
			Name:        "Primary Workspace",
			Slug:        "primary",
			Description: "Main browser-accessible workspace for daily operations.",
			Status:      "ready",
		},
		{
			Name:        "Deployments",
			Slug:        "deployments",
			Description: "Reserved area for future container launch and orchestration flows.",
			Status:      "planned",
		},
	}

	for _, item := range items {
		if _, err := s.db.Exec(
			`INSERT OR IGNORE INTO workspaces (name, slug, description, status) VALUES (?, ?, ?, ?)`,
			item.Name,
			item.Slug,
			item.Description,
			item.Status,
		); err != nil {
			return fmt.Errorf("seed workspaces: %w", err)
		}
	}

	return nil
}

func (s *Store) AuthenticateUser(email, password string) (*User, error) {
	var user User
	var passwordHash string
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))

	err := s.db.QueryRow(
		`SELECT id, email, role, password_hash, created_at FROM users WHERE email = ? LIMIT 1`,
		normalizedEmail,
	).Scan(&user.ID, &user.Email, &user.Role, &passwordHash, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := auth.CheckPassword(password, passwordHash); err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *Store) CreateSession(ctx context.Context, userID int64, ttl time.Duration) (*Session, error) {
	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	session := &Session{
		Token:     token,
		UserID:    userID,
		ExpiresAt: time.Now().Add(ttl).UTC(),
	}

	_, err = s.db.ExecContext(
		ctx,
		`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		session.Token,
		session.UserID,
		session.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, token)
	return err
}

func (s *Store) GetUserBySessionToken(ctx context.Context, token string) (*User, error) {
	var user User

	err := s.db.QueryRowContext(
		ctx,
		`SELECT u.id, u.email, u.role, u.created_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
		LIMIT 1`,
		token,
	).Scan(&user.ID, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *Store) ListWorkspaces(ctx context.Context) ([]Workspace, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, name, slug, description, status FROM workspaces ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	workspaces := make([]Workspace, 0)
	for rows.Next() {
		var item Workspace
		if err := rows.Scan(&item.ID, &item.Name, &item.Slug, &item.Description, &item.Status); err != nil {
			return nil, err
		}
		workspaces = append(workspaces, item)
	}

	return workspaces, rows.Err()
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, email, role, created_at FROM users ORDER BY role DESC, email ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var item User
		if err := rows.Scan(&item.ID, &item.Email, &item.Role, &item.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, item)
	}

	return users, rows.Err()
}

func (s *Store) CreateUser(ctx context.Context, input CreateUserInput) (*User, error) {
	role := normalizeRole(input.Role)
	hashedPassword, err := auth.HashPassword(input.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	result, err := s.db.ExecContext(
		ctx,
		`INSERT INTO users (email, role, password_hash) VALUES (?, ?, ?)`,
		strings.TrimSpace(strings.ToLower(input.Email)),
		role,
		hashedPassword,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetUserByID(ctx, id)
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (*User, error) {
	var user User

	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, email, role, created_at FROM users WHERE id = ? LIMIT 1`,
		id,
	).Scan(&user.ID, &user.Email, &user.Role, &user.CreatedAt)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func normalizeRole(role string) string {
	if strings.EqualFold(strings.TrimSpace(role), "admin") {
		return "admin"
	}

	return "user"
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random: %w", err)
	}

	return hex.EncodeToString(buf), nil
}
