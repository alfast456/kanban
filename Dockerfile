# Menggunakan base image Node.js versi 20
FROM node:20-alpine

# Menentukan direktori kerja di dalam container
WORKDIR /app

# Menyalin package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Menginstal semua dependensi
RUN npm install

# Menyalin seluruh source code ke dalam container
COPY . .

# Membangun (build) frontend React/Vite menjadi file statis
RUN npm run build

# Ekspos port yang digunakan oleh backend Node.js
EXPOSE 3334

# Menjalankan server backend
CMD ["npm", "start"]
