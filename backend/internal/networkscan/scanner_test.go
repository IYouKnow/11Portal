package networkscan

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestParseCIDRsNormalizesAndDeduplicates(t *testing.T) {
	targets, skipped, err := parseCIDRs([]string{"192.168.0.1/24", " 192.168.0.0/24 "})
	if err != nil {
		t.Fatalf("parseCIDRs returned error: %v", err)
	}

	if len(skipped) != 0 {
		t.Fatalf("expected no skipped CIDRs, got %v", skipped)
	}

	if len(targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(targets))
	}

	if got := targets[0].String(); got != "192.168.0.0/24" {
		t.Fatalf("expected normalized CIDR 192.168.0.0/24, got %q", got)
	}
}

func TestScanFindsResponsiveHostOnLoopback(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to open test listener: %v", err)
	}
	defer listener.Close()

	acceptDone := make(chan struct{})
	go func() {
		defer close(acceptDone)
		conn, err := listener.Accept()
		if err == nil {
			_ = conn.Close()
		}
	}()

	_, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatalf("failed to read listener port: %v", err)
	}

	results, summary, err := Scan(context.Background(), ScanOptions{
		CIDRs:       []string{"127.0.0.1/32"},
		Timeout:     200 * time.Millisecond,
		Concurrency: 1,
		MaxIPs:      16,
		ProbePorts:  []string{port},
	})
	if err != nil {
		t.Fatalf("Scan returned error: %v", err)
	}

	if summary.TotalIPs != 1 {
		t.Fatalf("expected 1 probed IP, got %d", summary.TotalIPs)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 discovered host, got %d", len(results))
	}

	if results[0].IP != "127.0.0.1" {
		t.Fatalf("expected discovered host 127.0.0.1, got %q", results[0].IP)
	}

	select {
	case <-acceptDone:
	case <-time.After(2 * time.Second):
		t.Fatal("test listener did not accept a connection")
	}
}
