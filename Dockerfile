# Menggunakan base image Node.js versi 20
FROM node:20-alpine

# Menentukan direktori kerja di dalam container
WORKDIR /app

# Menyalin package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Menginstal dependensi sesuai lockfile
RUN npm ci

# Menyalin seluruh source code ke dalam container
COPY . .

# Membangun (build) frontend React/Vite menjadi file statis
RUN npm run build

# Port internal container; host mapping diatur oleh docker-compose
EXPOSE 3333

# Menjalankan server backend
CMD ["npm", "start"]
