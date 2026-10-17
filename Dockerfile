# FYSH — صورة إنتاجية: تبني الواجهة والسيرفر ثم تشغّل السيرفر فقط
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
# بيانات المفاتيح والجلسات المحلية (يمكن ربطها بقرص دائم)
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
