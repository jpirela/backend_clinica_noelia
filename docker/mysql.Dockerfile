# Optional: custom MySQL image for auto-importing dumps on first boot
# Place your SQL files under docker/mysql-init/*.sql before deploying the blueprint
FROM mysql:8.0
ENV MYSQL_DATABASE=noelia
COPY docker/mysql-init/*.sql /docker-entrypoint-initdb.d/