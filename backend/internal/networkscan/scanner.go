package networkscan

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type Result struct {
	IP       string `json:"ip"`
	Hostname string `json:"hostname,omitempty"`
	MAC      string `json:"mac,omitempty"`
}

type Summary struct {
	ScannedCIDRs []string `json:"scannedCidrs"`
	SkippedCIDRs []string `json:"skippedCidrs"`
	TotalIPs     int      `json:"totalIps"`
}

type ScanOptions struct {
	CIDRs       []string
	Timeout     time.Duration
	Concurrency int
	MaxIPs      int
}

type resultSet struct {
	sync.Mutex
	items map[string]Result
}

func Scan(ctx context.Context, opts ScanOptions) ([]Result, Summary, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 300 * time.Millisecond
	}

	concurrency := opts.Concurrency
	if concurrency <= 0 {
		concurrency = 128
	}

	maxIPs := opts.MaxIPs
	if maxIPs <= 0 {
		maxIPs = 4096
	}

	targetNets, skipped, err := resolveTargets(opts.CIDRs, maxIPs)
	if err != nil {
		return nil, Summary{}, err
	}
	if len(targetNets) == 0 {
		return []Result{}, Summary{
			SkippedCIDRs: skipped,
		}, nil
	}

	targetIPs := make([]string, 0, 256)
	scannedCIDRs := make([]string, 0, len(targetNets))
	for _, targetNet := range targetNets {
		scannedCIDRs = append(scannedCIDRs, targetNet.String())
		targetIPs = append(targetIPs, enumerateIPv4Hosts(targetNet)...)
	}
	targetIPs = uniqueStrings(targetIPs)
	sort.Strings(targetIPs)

	if len(targetIPs) == 0 {
		return []Result{}, Summary{
			ScannedCIDRs: scannedCIDRs,
			SkippedCIDRs: skipped,
		}, nil
	}

	seen := &resultSet{items: map[string]Result{}}
	jobs := make(chan string)
	var workers sync.WaitGroup

	for i := 0; i < concurrency; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			dialer := net.Dialer{Timeout: timeout}
			for ip := range jobs {
				if ctx.Err() != nil {
					return
				}

				_, _ = dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip, "80"))
			}
		}()
	}

	go func() {
		defer close(jobs)
		for _, ip := range targetIPs {
			select {
			case <-ctx.Done():
				return
			case jobs <- ip:
			}
		}
	}()

	workers.Wait()

	select {
	case <-ctx.Done():
		return nil, Summary{}, ctx.Err()
	case <-time.After(120 * time.Millisecond):
	}

	arpEntries, _ := readARPTable()
	for _, ip := range targetIPs {
		mac := arpEntries[ip]
		if mac == "" || isZeroMAC(mac) {
			continue
		}

		seen.Lock()
		if _, exists := seen.items[ip]; !exists {
			seen.items[ip] = Result{
				IP:       ip,
				Hostname: lookupHostname(ctx, ip),
				MAC:      strings.ToUpper(mac),
			}
		}
		seen.Unlock()
	}

	results := make([]Result, 0, len(seen.items))
	for _, item := range seen.items {
		results = append(results, item)
	}
	sort.Slice(results, func(i, j int) bool {
		return compareIPv4(results[i].IP, results[j].IP) < 0
	})

	return results, Summary{
		ScannedCIDRs: scannedCIDRs,
		SkippedCIDRs: skipped,
		TotalIPs:     len(targetIPs),
	}, nil
}

func resolveTargets(cidrs []string, maxIPs int) ([]*net.IPNet, []string, error) {
	if len(cidrs) > 0 {
		return parseCIDRs(cidrs)
	}

	return discoverTargets(maxIPs)
}

func parseCIDRs(cidrs []string) ([]*net.IPNet, []string, error) {
	targets := make([]*net.IPNet, 0, len(cidrs))
	skipped := []string{}
	seen := map[string]struct{}{}

	for _, raw := range cidrs {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}

		_, ipNet, err := net.ParseCIDR(trimmed)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid cidr %q: %w", trimmed, err)
		}

		ip := ipNet.IP.To4()
		if ip == nil {
			skipped = append(skipped, trimmed)
			continue
		}

		ipNet.IP = ip.Mask(ipNet.Mask)
		key := ipNet.String()
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		targets = append(targets, ipNet)
	}

	return targets, skipped, nil
}

func discoverTargets(maxIPs int) ([]*net.IPNet, []string, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, nil, err
	}

	targets := []*net.IPNet{}
	skipped := []string{}
	seen := map[string]struct{}{}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}

			ip := ipNet.IP.To4()
			if ip == nil {
				continue
			}

			ipNetCopy := &net.IPNet{
				IP:   ip.Mask(ipNet.Mask),
				Mask: ipNet.Mask,
			}
			key := ipNetCopy.String()
			if _, exists := seen[key]; exists {
				continue
			}

			hostCount := ipv4HostCount(ipNetCopy)
			if hostCount > maxIPs {
				skipped = append(skipped, key)
				continue
			}

			if hostCount <= 0 {
				continue
			}

			seen[key] = struct{}{}
			targets = append(targets, ipNetCopy)
		}
	}

	return targets, skipped, nil
}

func enumerateIPv4Hosts(ipNet *net.IPNet) []string {
	network := ipNet.IP.To4()
	if network == nil {
		return nil
	}

	mask := ipNet.Mask
	if mask == nil {
		return nil
	}

	ones, bits := mask.Size()
	hostBits := bits - ones
	hostCount := ipv4HostCount(ipNet)
	if hostCount <= 0 {
		return nil
	}

	start := append(net.IP(nil), network...)
	results := make([]string, 0, hostCount)

	switch hostBits {
	case 0:
		results = append(results, start.String())
		return results
	case 1:
		results = append(results, start.String())
		other := append(net.IP(nil), start...)
		incIPv4(other)
		results = append(results, other.String())
		return results
	}

	broadcast := broadcastIPv4(network, mask)
	current := append(net.IP(nil), start...)
	incIPv4(current)
	for !current.Equal(broadcast) {
		results = append(results, current.String())
		incIPv4(current)
	}

	return results
}

func broadcastIPv4(ip net.IP, mask net.IPMask) net.IP {
	broadcast := make(net.IP, len(ip))
	for i := 0; i < len(ip); i++ {
		broadcast[i] = ip[i] | ^mask[i]
	}
	return broadcast
}

func incIPv4(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			break
		}
	}
}

func ipv4HostCount(ipNet *net.IPNet) int {
	ones, bits := ipNet.Mask.Size()
	if bits != 32 || ones < 0 {
		return 0
	}

	hostBits := bits - ones
	if hostBits <= 0 {
		return 1
	}

	total := 1 << hostBits
	if hostBits == 1 {
		return total
	}

	if total <= 2 {
		return 0
	}

	return total - 2
}

func readARPTable() (map[string]string, error) {
	file, err := os.Open("/proc/net/arp")
	if err != nil {
		return map[string]string{}, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	entries := map[string]string{}
	line := 0
	for scanner.Scan() {
		line++
		if line == 1 {
			continue
		}

		fields := strings.Fields(scanner.Text())
		if len(fields) < 4 {
			continue
		}

		ip := fields[0]
		mac := strings.ToUpper(fields[3])
		if ip == "" || mac == "" {
			continue
		}
		entries[ip] = mac
	}

	return entries, scanner.Err()
}

func lookupHostname(ctx context.Context, ip string) string {
	names, err := net.DefaultResolver.LookupAddr(ctx, ip)
	if err != nil || len(names) == 0 {
		return ""
	}

	hostname := strings.TrimSuffix(strings.TrimSpace(names[0]), ".")
	return hostname
}

func compareIPv4(left, right string) int {
	leftIP := net.ParseIP(left).To4()
	rightIP := net.ParseIP(right).To4()
	if leftIP == nil || rightIP == nil {
		return strings.Compare(left, right)
	}

	for i := 0; i < 4; i++ {
		if leftIP[i] != rightIP[i] {
			return int(leftIP[i]) - int(rightIP[i])
		}
	}

	return 0
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func isZeroMAC(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	return normalized == "00:00:00:00:00:00"
}
