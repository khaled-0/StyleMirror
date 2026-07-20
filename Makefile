.PHONY: dev dev-api dev-web up down logs userscript

dev: dev-api dev-web

dev-api:
	cd api && go run . -config config.yaml

dev-web:
	cd web && npm run dev

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

userscript:
	@echo "Open Tampermonkey dashboard → Create new script → paste contents of userscript/stylemirror.user.js"
	@echo "Set window.SM_API_BASE in the script header if your API is not at localhost:8080"
