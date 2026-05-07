package cache

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"time"
)

// Client is a minimal Redis client using raw TCP to avoid heavy deps.
// For production, consider replacing with github.com/redis/go-redis/v9.
type Client struct {
	addr string
	pool chan net.Conn
}

func NewRedisClient(redisURL string) (*Client, error) {
	// Parse redis://host:port/db
	addr := "localhost:6379"
	if len(redisURL) > 8 {
		// Strip redis://
		stripped := redisURL
		if len(stripped) > 8 && stripped[:8] == "redis://" {
			stripped = stripped[8:]
		}
		// Strip /db suffix
		for i := len(stripped) - 1; i >= 0; i-- {
			if stripped[i] == '/' {
				stripped = stripped[:i]
				break
			}
		}
		// Strip user:pass@
		for i := 0; i < len(stripped); i++ {
			if stripped[i] == '@' {
				stripped = stripped[i+1:]
				break
			}
		}
		if stripped != "" {
			addr = stripped
		}
	}

	// Create a simple connection pool
	pool := make(chan net.Conn, 10)
	for i := 0; i < 3; i++ {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err != nil {
			return nil, fmt.Errorf("connecting to redis at %s: %w", addr, err)
		}
		pool <- conn
	}

	return &Client{addr: addr, pool: pool}, nil
}

func (c *Client) getConn() (net.Conn, error) {
	select {
	case conn := <-c.pool:
		return conn, nil
	default:
		return net.DialTimeout("tcp", c.addr, 2*time.Second)
	}
}

func (c *Client) putConn(conn net.Conn) {
	select {
	case c.pool <- conn:
	default:
		conn.Close()
	}
}

func (c *Client) do(ctx context.Context, args ...string) (string, error) {
	conn, err := c.getConn()
	if err != nil {
		return "", err
	}
	defer c.putConn(conn)

	// Set deadline from context
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(2 * time.Second)
	}
	conn.SetDeadline(deadline)

	// RESP protocol: *{n}\r\n${len}\r\n{arg}\r\n...
	cmd := fmt.Sprintf("*%d\r\n", len(args))
	for _, arg := range args {
		cmd += fmt.Sprintf("$%d\r\n%s\r\n", len(arg), arg)
	}

	_, err = conn.Write([]byte(cmd))
	if err != nil {
		return "", err
	}

	// Read response (simplified — handles +, -, :, $ prefixes)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		return "", err
	}

	resp := string(buf[:n])
	if len(resp) == 0 {
		return "", fmt.Errorf("empty response")
	}

	switch resp[0] {
	case '+': // Simple string
		return resp[1 : len(resp)-2], nil
	case '-': // Error
		return "", fmt.Errorf("redis: %s", resp[1:len(resp)-2])
	case ':': // Integer
		return resp[1 : len(resp)-2], nil
	case '$': // Bulk string
		if resp[1] == '-' {
			return "", nil // nil
		}
		// Find the data after the length line
		for i := 1; i < len(resp); i++ {
			if resp[i] == '\n' {
				end := len(resp) - 2
				if end > i+1 {
					return resp[i+1 : end], nil
				}
				return "", nil
			}
		}
		return "", nil
	default:
		return resp, nil
	}
}

// Incr atomically increments a key and returns the new value.
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	resp, err := c.do(ctx, "INCR", key)
	if err != nil {
		return 0, err
	}
	val, err := strconv.ParseInt(resp, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing INCR response %q: %w", resp, err)
	}
	return val, nil
}

// Expire sets a TTL on a key.
func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) error {
	_, err := c.do(ctx, "EXPIRE", key, strconv.Itoa(int(ttl.Seconds())))
	return err
}

// TTL returns the time-to-live of a key.
func (c *Client) TTL(ctx context.Context, key string) (time.Duration, error) {
	resp, err := c.do(ctx, "TTL", key)
	if err != nil {
		return 0, err
	}
	secs, err := strconv.ParseInt(resp, 10, 64)
	if err != nil {
		return 0, err
	}
	if secs < 0 {
		return 0, nil
	}
	return time.Duration(secs) * time.Second, nil
}

// Close closes all pooled connections.
func (c *Client) Close() {
	close(c.pool)
	for conn := range c.pool {
		conn.Close()
	}
}
