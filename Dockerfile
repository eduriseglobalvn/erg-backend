FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN yarn install
COPY . .
RUN yarn build
# Cổng bắt buộc của Hugging Face
ENV PORT=7860
EXPOSE 7860
CMD ["node", "dist/main.js"]