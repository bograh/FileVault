package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/filevault/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: migrate [up|down]")
	}

	direction := os.Args[1]
	if direction != "up" && direction != "down" {
		log.Fatal("usage: migrate [up|down]")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	db, err := pgxpool.New(context.Background(), cfg.DB.URL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Ensure migrations tracking table exists
	_, err = db.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatalf("failed to create migrations table: %v", err)
	}

	// Find migration files
	migrationsDir := cfg.DB.MigrationsPath
	suffix := "." + direction + ".sql"

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("failed to read migrations directory: %v", err)
	}

	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), suffix) {
			files = append(files, e.Name())
		}
	}

	if direction == "up" {
		sort.Strings(files)
	} else {
		sort.Sort(sort.Reverse(sort.StringSlice(files)))
	}

	for _, f := range files {
		// Extract version: "001_initial_schema.up.sql" → "001_initial_schema"
		version := strings.TrimSuffix(f, "."+direction+".sql")

		if direction == "up" {
			// Check if already applied
			var exists bool
			err := db.QueryRow(context.Background(),
				"SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
			if err != nil {
				log.Fatalf("failed to check migration status for %s: %v", version, err)
			}
			if exists {
				fmt.Printf("skip (already applied): %s\n", f)
				continue
			}
		} else {
			// For down: check if migration was applied
			var exists bool
			err := db.QueryRow(context.Background(),
				"SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
			if err != nil {
				log.Fatalf("failed to check migration status for %s: %v", version, err)
			}
			if !exists {
				fmt.Printf("skip (not applied): %s\n", f)
				continue
			}
		}

		content, err := os.ReadFile(filepath.Join(migrationsDir, f))
		if err != nil {
			log.Fatalf("failed to read migration %s: %v", f, err)
		}

		_, err = db.Exec(context.Background(), string(content))
		if err != nil {
			log.Fatalf("failed to apply migration %s: %v", f, err)
		}

		if direction == "up" {
			_, err = db.Exec(context.Background(),
				"INSERT INTO schema_migrations (version) VALUES ($1)", version)
			if err != nil {
				log.Fatalf("failed to record migration %s: %v", version, err)
			}
		} else {
			_, err = db.Exec(context.Background(),
				"DELETE FROM schema_migrations WHERE version = $1", version)
			if err != nil {
				log.Fatalf("failed to remove migration record %s: %v", version, err)
			}
		}

		fmt.Printf("applied: %s\n", f)
	}

	fmt.Println("migrations complete")
}
