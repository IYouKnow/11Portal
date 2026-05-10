FROM golang:1.23-alpine AS build

WORKDIR /app

RUN apk add --no-cache build-base

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /portal-api ./cmd/portal-api

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates bash docker-cli openssh-client

COPY --from=build /portal-api /usr/local/bin/portal-api

EXPOSE 8080

CMD ["portal-api"]
