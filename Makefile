.PHONY: help dev build start stop clean install migrate seed test lint format docker-up docker-down docker-logs

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	npm install
	npx prisma generate

dev: ## Start development server
	npm run dev

build: ## Build production bundle
	npm run build

start: ## Start production server
	npm start

migrate: ## Run database migrations
	npx prisma migrate dev

migrate-prod: ## Run database migrations (production)
	npx prisma migrate deploy

seed: ## Seed database with test data
	npx prisma db seed

reset: ## Reset database
	npx prisma migrate reset --force

studio: ## Open Prisma Studio
	npx prisma studio

test: ## Run tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage
	npm run test:coverage

lint: ## Lint code
	npm run lint

format: ## Format code
	npm run format

type-check: ## Type check
	npm run type-check

clean: ## Clean build artifacts
	rm -rf .next node_modules dist

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-build: ## Build Docker images
	docker-compose build

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-shell: ## Open shell in app container
	docker-compose exec app sh

db-console: ## Open PostgreSQL console
	docker-compose exec postgres psql -U shift4 -d shift4_payments

# Development workflow
setup: install migrate seed ## Setup project (install + migrate + seed)
	@echo "✅ Project setup complete!"
	@echo "Run 'make dev' to start development server"

# Production workflow
deploy: migrate-prod build ## Deploy to production
	@echo "✅ Deployment complete!"
