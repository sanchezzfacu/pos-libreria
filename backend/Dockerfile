# Railway arma la imagen a partir de este Dockerfile automáticamente
# (con la carpeta raíz del servicio apuntando a /backend). Esto es lo que
# resuelve el tema de poppler-utils en producción: se instala solo, cada
# vez que Railway construye la imagen — no hace falta instalar nada a mano
# ahí.

FROM node:20-slim

# poppler-utils da el comando "pdftotext" que usa el parser de PDF
# (backend/src/parsers/pdfParser.js).
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Railway inyecta su propia variable PORT; el server.js ya la respeta
# (process.env.PORT || 4000), así que no hace falta tocar nada acá.
EXPOSE 4000

CMD ["node", "src/server.js"]
