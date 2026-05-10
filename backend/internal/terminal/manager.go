package terminal

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

var (
	ErrSessionNotFound  = errors.New("terminal session not found")
	ErrSessionForbidden = errors.New("terminal session access forbidden")
	ErrInvalidConfig    = errors.New("invalid terminal session config")
)

type SessionType string

const (
	SessionTypeLocal SessionType = "local"
	SessionTypeSSH   SessionType = "ssh"
)

type SSHAuthType string

const (
	SSHAuthPassword SSHAuthType = "password"
	SSHAuthKey      SSHAuthType = "private_key"
)

type SSHConfig struct {
	Host       string
	Port       int
	Username   string
	AuthType   SSHAuthType
	Password   string
	PrivateKey string
	Passphrase string
}

type CreateSessionInput struct {
	Type  SessionType
	Shell string
	SSH   *SSHConfig
}

type SessionView struct {
	ID           string      `json:"id"`
	Type         SessionType `json:"type"`
	OwnerUserID  int64       `json:"ownerUserId"`
	Title        string      `json:"title"`
	CreatedAt    time.Time   `json:"createdAt"`
	LastActiveAt time.Time   `json:"lastActiveAt"`
}

type managedSession struct {
	meta    SessionView
	ptmx    io.ReadWriteCloser
	closeFn func() error
	lastErr error
	closed  bool
	mu      sync.RWMutex
}

func (s *managedSession) touch() {
	s.mu.Lock()
	s.meta.LastActiveAt = time.Now().UTC()
	s.mu.Unlock()
}

func (s *managedSession) view() SessionView {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.meta
}

func (s *managedSession) close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	s.mu.Unlock()

	if s.closeFn != nil {
		return s.closeFn()
	}
	return nil
}

type Manager struct {
	sessions    map[string]*managedSession
	idleTimeout time.Duration
	mu          sync.RWMutex
}

type SessionHandle struct {
	session *managedSession
}

func NewManager(idleTimeout time.Duration) *Manager {
	if idleTimeout <= 0 {
		idleTimeout = 30 * time.Minute
	}
	return &Manager{
		sessions:    make(map[string]*managedSession),
		idleTimeout: idleTimeout,
	}
}

func (m *Manager) StartReaper(interval time.Duration) func() {
	if interval <= 0 {
		interval = time.Minute
	}

	ticker := time.NewTicker(interval)
	stop := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				m.ReapIdle()
			case <-stop:
				ticker.Stop()
				return
			}
		}
	}()

	return func() {
		close(stop)
	}
}

func (m *Manager) ReapIdle() {
	now := time.Now().UTC()
	var toClose []string

	m.mu.RLock()
	for id, session := range m.sessions {
		view := session.view()
		if now.Sub(view.LastActiveAt) > m.idleTimeout {
			toClose = append(toClose, id)
		}
	}
	m.mu.RUnlock()

	for _, id := range toClose {
		_ = m.CloseSession(id, 0, true)
	}
}

func (m *Manager) CreateSession(ownerUserID int64, input CreateSessionInput) (*SessionView, error) {
	if ownerUserID <= 0 {
		return nil, ErrInvalidConfig
	}

	now := time.Now().UTC()
	id := uuid.NewString()
	view := SessionView{
		ID:           id,
		Type:         input.Type,
		OwnerUserID:  ownerUserID,
		CreatedAt:    now,
		LastActiveAt: now,
	}

	var session *managedSession
	var err error
	switch input.Type {
	case SessionTypeLocal:
		view.Title = "Local Shell"
		session, err = newLocalSession(view, input.Shell)
	case SessionTypeSSH:
		if input.SSH == nil {
			return nil, ErrInvalidConfig
		}
		view.Title = fmt.Sprintf("%s@%s:%d", input.SSH.Username, input.SSH.Host, input.SSH.Port)
		session, err = newSSHSession(view, *input.SSH)
	default:
		return nil, ErrInvalidConfig
	}
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.sessions[id] = session
	m.mu.Unlock()

	created := view
	return &created, nil
}

func (m *Manager) ListSessions(ownerUserID int64) []SessionView {
	m.mu.RLock()
	defer m.mu.RUnlock()

	items := make([]SessionView, 0, len(m.sessions))
	for _, session := range m.sessions {
		view := session.view()
		if view.OwnerUserID == ownerUserID {
			items = append(items, view)
		}
	}
	return items
}

func (m *Manager) GetOwnedSession(id string, ownerUserID int64) (*managedSession, error) {
	m.mu.RLock()
	session, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return nil, ErrSessionNotFound
	}
	view := session.view()
	if view.OwnerUserID != ownerUserID {
		return nil, ErrSessionForbidden
	}
	return session, nil
}

func (m *Manager) AttachSession(id string, ownerUserID int64) (*SessionHandle, error) {
	session, err := m.GetOwnedSession(id, ownerUserID)
	if err != nil {
		return nil, err
	}
	session.touch()
	return &SessionHandle{session: session}, nil
}

func (m *Manager) CloseSession(id string, ownerUserID int64, force bool) error {
	m.mu.Lock()
	session, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return ErrSessionNotFound
	}
	if !force && ownerUserID > 0 {
		view := session.view()
		if view.OwnerUserID != ownerUserID {
			m.mu.Unlock()
			return ErrSessionForbidden
		}
	}
	delete(m.sessions, id)
	m.mu.Unlock()

	return session.close()
}

func (h *SessionHandle) Read(p []byte) (int, error) {
	n, err := h.session.ptmx.Read(p)
	if n > 0 {
		h.session.touch()
	}
	return n, err
}

func (h *SessionHandle) Write(p []byte) (int, error) {
	n, err := h.session.ptmx.Write(p)
	if n > 0 {
		h.session.touch()
	}
	return n, err
}

func newLocalSession(view SessionView, shell string) (*managedSession, error) {
	cmd := exec.Command(shell)
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	return &managedSession{
		meta: view,
		ptmx: ptmx,
		closeFn: func() error {
			_ = ptmx.Close()
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			return nil
		},
	}, nil
}

func newSSHSession(view SessionView, cfg SSHConfig) (*managedSession, error) {
	if cfg.Host == "" || cfg.Username == "" {
		return nil, ErrInvalidConfig
	}
	port := cfg.Port
	if port == 0 {
		port = 22
	}

	authMethod, err := buildAuthMethod(cfg)
	if err != nil {
		return nil, err
	}

	clientConfig := &ssh.ClientConfig{
		User:            cfg.Username,
		Auth:            []ssh.AuthMethod{authMethod},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         15 * time.Second,
	}

	address := cfg.Host + ":" + strconv.Itoa(port)
	client, err := ssh.Dial("tcp", address, clientConfig)
	if err != nil {
		return nil, err
	}

	session, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return nil, err
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		_ = session.Close()
		_ = client.Close()
		return nil, err
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		_ = session.Close()
		_ = client.Close()
		return nil, err
	}
	stdout, err := session.StdoutPipe()
	if err != nil {
		_ = session.Close()
		_ = client.Close()
		return nil, err
	}
	stderr, err := session.StderrPipe()
	if err != nil {
		_ = session.Close()
		_ = client.Close()
		return nil, err
	}

	pipe := &sshPipe{
		stdin:  stdin,
		stdout: io.MultiReader(stdout, stderr),
		closeFn: func() error {
			_ = session.Close()
			return client.Close()
		},
	}

	if err := session.Shell(); err != nil {
		_ = pipe.Close()
		return nil, err
	}

	return &managedSession{
		meta:    view,
		ptmx:    pipe,
		closeFn: pipe.Close,
	}, nil
}

func buildAuthMethod(cfg SSHConfig) (ssh.AuthMethod, error) {
	switch cfg.AuthType {
	case SSHAuthPassword:
		password := cfg.Password
		cfg.Password = ""
		if password == "" {
			return nil, ErrInvalidConfig
		}
		return ssh.Password(password), nil
	case SSHAuthKey:
		key := cfg.PrivateKey
		passphrase := cfg.Passphrase
		cfg.PrivateKey = ""
		cfg.Passphrase = ""

		var signer ssh.Signer
		var err error
		if passphrase == "" {
			signer, err = ssh.ParsePrivateKey([]byte(key))
		} else {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(key), []byte(passphrase))
		}
		zeroString(&key)
		zeroString(&passphrase)
		if err != nil {
			return nil, err
		}
		return ssh.PublicKeys(signer), nil
	default:
		return nil, ErrInvalidConfig
	}
}

func zeroString(value *string) {
	if value == nil || *value == "" {
		return
	}
	buf := []byte(*value)
	for i := range buf {
		buf[i] = 0
	}
	*value = string(bytes.Repeat([]byte{0}, len(buf)))
	*value = ""
}

type sshPipe struct {
	stdin   io.WriteCloser
	stdout  io.Reader
	closeFn func() error
}

func (p *sshPipe) Read(b []byte) (int, error) {
	return p.stdout.Read(b)
}

func (p *sshPipe) Write(b []byte) (int, error) {
	return p.stdin.Write(b)
}

func (p *sshPipe) Close() error {
	if p.stdin != nil {
		_ = p.stdin.Close()
	}
	if p.closeFn != nil {
		return p.closeFn()
	}
	return nil
}
