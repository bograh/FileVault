package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

// DocsHandler serves OpenAPI spec and Swagger UI.
type DocsHandler struct {
	specPath string
}

func NewDocsHandler() *DocsHandler {
	// Find spec relative to this source file for dev, or from working dir for prod.
	specPath := "docs/openapi.yaml"

	// Try relative to binary working directory first
	if _, err := os.Stat(specPath); err != nil {
		// Try relative to source file (for tests)
		_, filename, _, _ := runtime.Caller(0)
		dir := filepath.Dir(filepath.Dir(filepath.Dir(filename)))
		specPath = filepath.Join(dir, "docs", "openapi.yaml")
	}

	return &DocsHandler{specPath: specPath}
}

// Spec serves the raw OpenAPI YAML spec.
func (h *DocsHandler) Spec(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(h.specPath)
	if err != nil {
		http.Error(w, "OpenAPI spec not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/yaml")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Write(data)
}

// SwaggerUI serves a minimal Swagger UI HTML page.
func (h *DocsHandler) SwaggerUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(swaggerUIHTML))
}

const swaggerUIHTML = `<!DOCTYPE html>
<html>
<head>
  <title>FileVault API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`
