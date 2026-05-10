package main

import (
	"log"

	"github.com/portal/backend/internal/config"
	"github.com/portal/backend/internal/database"
	httpserver "github.com/portal/backend/internal/http"
	"github.com/portal/backend/internal/store"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	dataStore := store.New(db)
	if err := dataStore.Initialize(cfg); err != nil {
		log.Fatalf("initialize store: %v", err)
	}

	app := httpserver.New(cfg, dataStore)

	log.Printf("portal backend listening on %s", cfg.HTTPAddr)
	if err := app.Listen(cfg.HTTPAddr); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
