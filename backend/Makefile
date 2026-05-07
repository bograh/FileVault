.PHONY: build run test migrate lint sqlc docker-up docker-down

APP_NAME := filevault-api
WORKER_NAME := filevault-worker

build:
	go build -o bin/$(APP_NAME) ./cmd/api
	go build -o bin/$(WORKER_NAME) ./cmd/worker

run:
	go run ./cmd/api

run-worker:
	go run ./cmd/worker

test:
	go test ./... -v -race -count=1

lint:
	golangci-lint run ./...

migrate-up:
	go run ./cmd/migrate up

migrate-down:
	go run ./cmd/migrate down

sqlc:
	sqlc generate

docker-up:
	docker compose -f ../docker-compose.yml up -d

docker-down:
	docker compose -f ../docker-compose.yml down

tidy:
	go mod tidy
