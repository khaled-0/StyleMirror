FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/api .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /out/api /api
COPY config.yaml /config.yaml
EXPOSE 8080
ENTRYPOINT ["/api", "-config", "/config.yaml"]
