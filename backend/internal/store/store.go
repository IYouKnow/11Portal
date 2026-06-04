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

type RemoteDesktopProfile struct {
	ID                    int64     `json:"id"`
	UserID                int64     `json:"userId"`
	Name                  string    `json:"name"`
	Host                  string    `json:"host"`
	Port                  int       `json:"port"`
	Domain                string    `json:"domain"`
	Username              string    `json:"username"`
	IgnoreCert            bool      `json:"ignoreCert"`
	GuacamoleConnectionID int64     `json:"-"`
	CreatedAt             time.Time `json:"createdAt"`
}

type Note struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	Title     string    `json:"title"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
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

type CreateRemoteDesktopProfileInput struct {
	Name       string
	Host       string
	Port       int
	Domain     string
	Username   string
	IgnoreCert bool
}

type CreateNoteInput struct {
	Title string
	Text  string
}

type UpdateNoteInput struct {
	Title string
	Text  string
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
		`CREATE TABLE IF NOT EXISTS remote_desktop_profiles (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			label TEXT NOT NULL,
			host TEXT NOT NULL,
			port INTEGER NOT NULL DEFAULT 3389,
			username TEXT NOT NULL DEFAULT '',
			domain TEXT NOT NULL DEFAULT '',
			ignore_cert INTEGER NOT NULL DEFAULT 0,
			guacamole_connection_id INTEGER,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			text TEXT NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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

	if _, err := s.db.Exec(`ALTER TABLE remote_desktop_profiles ADD COLUMN domain TEXT NOT NULL DEFAULT ''`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add remote desktop domain: %w", err)
	}

	if _, err := s.db.Exec(`ALTER TABLE remote_desktop_profiles ADD COLUMN ignore_cert INTEGER NOT NULL DEFAULT 0`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add remote desktop ignore_cert: %w", err)
	}

	if _, err := s.db.Exec(`ALTER TABLE remote_desktop_profiles ADD COLUMN guacamole_connection_id INTEGER`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add remote desktop guacamole_connection_id: %w", err)
	}

	if _, err := s.db.Exec(`UPDATE remote_desktop_profiles SET username = '' WHERE username IS NULL`); err != nil {
		return fmt.Errorf("migrate backfill remote desktop username: %w", err)
	}

	if _, err := s.db.Exec(`UPDATE remote_desktop_profiles SET domain = '' WHERE domain IS NULL`); err != nil {
		return fmt.Errorf("migrate backfill remote desktop domain: %w", err)
	}

	if _, err := s.db.Exec(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add note title: %w", err)
	}

	if _, err := s.db.Exec(`ALTER TABLE notes ADD COLUMN text TEXT NOT NULL DEFAULT ''`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add note text: %w", err)
	}

	if _, err := s.db.Exec(`ALTER TABLE notes ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return fmt.Errorf("migrate add note updated_at: %w", err)
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

func (s *Store) ListRemoteDesktopProfiles(ctx context.Context, userID int64) ([]RemoteDesktopProfile, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, user_id, label, host, port, domain, username, ignore_cert, guacamole_connection_id, created_at
		FROM remote_desktop_profiles
		WHERE user_id = ?
		ORDER BY label ASC, id ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]RemoteDesktopProfile, 0)
	for rows.Next() {
		var item RemoteDesktopProfile
		var ignoreCert int
		var guacamoleConnectionID sql.NullInt64
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Name,
			&item.Host,
			&item.Port,
			&item.Domain,
			&item.Username,
			&ignoreCert,
			&guacamoleConnectionID,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.IgnoreCert = ignoreCert != 0
		if guacamoleConnectionID.Valid {
			item.GuacamoleConnectionID = guacamoleConnectionID.Int64
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (s *Store) CreateRemoteDesktopProfile(ctx context.Context, userID int64, input CreateRemoteDesktopProfileInput) (*RemoteDesktopProfile, error) {
	result, err := s.db.ExecContext(
		ctx,
		`INSERT INTO remote_desktop_profiles (user_id, label, host, port, domain, username, ignore_cert)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userID,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Host),
		input.Port,
		strings.TrimSpace(input.Domain),
		strings.TrimSpace(input.Username),
		boolToInt(input.IgnoreCert),
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetRemoteDesktopProfileByID(ctx, userID, id)
}

func (s *Store) GetRemoteDesktopProfileByID(ctx context.Context, userID, profileID int64) (*RemoteDesktopProfile, error) {
	var item RemoteDesktopProfile
	var ignoreCert int
	var guacamoleConnectionID sql.NullInt64

	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, user_id, label, host, port, domain, username, ignore_cert, guacamole_connection_id, created_at
		FROM remote_desktop_profiles
		WHERE id = ? AND user_id = ?
		LIMIT 1`,
		profileID,
		userID,
	).Scan(
		&item.ID,
		&item.UserID,
		&item.Name,
		&item.Host,
		&item.Port,
		&item.Domain,
		&item.Username,
		&ignoreCert,
		&guacamoleConnectionID,
		&item.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	item.IgnoreCert = ignoreCert != 0
	if guacamoleConnectionID.Valid {
		item.GuacamoleConnectionID = guacamoleConnectionID.Int64
	}

	return &item, nil
}

func (s *Store) DeleteRemoteDesktopProfile(ctx context.Context, userID, profileID int64) (bool, error) {
	result, err := s.db.ExecContext(
		ctx,
		`DELETE FROM remote_desktop_profiles WHERE id = ? AND user_id = ?`,
		profileID,
		userID,
	)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

func (s *Store) UpdateRemoteDesktopProfileConnectionID(ctx context.Context, userID, profileID, connectionID int64) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE remote_desktop_profiles
		SET guacamole_connection_id = ?
		WHERE id = ? AND user_id = ?`,
		connectionID,
		profileID,
		userID,
	)
	return err
}

func (s *Store) ListNotes(ctx context.Context, userID int64) ([]Note, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, user_id, title, text, created_at, updated_at
		FROM notes
		WHERE user_id = ?
		ORDER BY datetime(updated_at) DESC, id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Note, 0)
	for rows.Next() {
		var item Note
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Title,
			&item.Text,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (s *Store) CreateNote(ctx context.Context, userID int64, input CreateNoteInput) (*Note, error) {
	now := time.Now().UTC()
	title := strings.TrimSpace(input.Title)
	text := input.Text

	result, err := s.db.ExecContext(
		ctx,
		`INSERT INTO notes (user_id, title, text, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`,
		userID,
		title,
		text,
		now,
		now,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetNoteByID(ctx, userID, id)
}

func (s *Store) GetNoteByID(ctx context.Context, userID, noteID int64) (*Note, error) {
	var item Note

	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, user_id, title, text, created_at, updated_at
		FROM notes
		WHERE id = ? AND user_id = ?
		LIMIT 1`,
		noteID,
		userID,
	).Scan(&item.ID, &item.UserID, &item.Title, &item.Text, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &item, nil
}

func (s *Store) UpdateNote(ctx context.Context, userID, noteID int64, input UpdateNoteInput) (*Note, error) {
	title := strings.TrimSpace(input.Title)
	text := input.Text
	now := time.Now().UTC()

	result, err := s.db.ExecContext(
		ctx,
		`UPDATE notes
		SET title = ?, text = ?, updated_at = ?
		WHERE id = ? AND user_id = ?`,
		title,
		text,
		now,
		noteID,
		userID,
	)
	if err != nil {
		return nil, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rowsAffected == 0 {
		return nil, sql.ErrNoRows
	}

	return s.GetNoteByID(ctx, userID, noteID)
}

func (s *Store) DeleteNote(ctx context.Context, userID, noteID int64) (bool, error) {
	result, err := s.db.ExecContext(
		ctx,
		`DELETE FROM notes WHERE id = ? AND user_id = ?`,
		noteID,
		userID,
	)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
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

func boolToInt(value bool) int {
	if value {
		return 1
	}

	return 0
}
