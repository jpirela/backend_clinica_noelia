Coloca aquí scripts SQL para inicializar la base de datos al levantar el contenedor MySQL.

Cómo usar:
- Copia tu dump (por ejemplo, `noelia.sql`) dentro de esta carpeta y renómbralo con un prefijo numérico, p.ej. `01-noelia.sql`.
- Al crear el contenedor por primera vez, MySQL ejecutará todos los `.sql` en orden alfabético.
- Si la DB ya existe en el volumen `db_data`, estos scripts NO se re-ejecutan.

Notas:
- Asegúrate de que el dump es compatible con MySQL 8 (collation utf8mb4_0900_ai_ci) o aplica los reemplazos sugeridos en el README.
- El usuario/clave configurados en docker-compose son `root` / `12345678`. Ajusta a tus necesidades.
