#!/bin/bash

# Script para configurar el primer usuario admin
# Uso: ./scripts/setup-admin.sh

API_URL="http://localhost:3000/api"
EMAIL="admin@magnetic.com"
PASSWORD="Admin123!"
FIRST_NAME="Admin"
LAST_NAME="Magnetic"

echo "🚀 Configurando Login Magnetic..."
echo ""

# 1. Registrar usuario
echo "1️⃣ Creando usuario admin..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"firstName\": \"$FIRST_NAME\",
    \"lastName\": \"$LAST_NAME\"
  }")

USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "❌ Error al crear usuario. Respuesta:"
  echo $REGISTER_RESPONSE
  exit 1
fi

echo "✅ Usuario creado con ID: $USER_ID"
echo ""

# 2. Mensaje para marcar como admin
echo "2️⃣ Ahora debes marcar este usuario como admin en la base de datos:"
echo ""
echo "   Ejecuta en PostgreSQL:"
echo "   UPDATE users SET is_admin = true WHERE id = '$USER_ID';"
echo ""
echo "   Con Docker:"
echo "   docker exec -it magnetic-postgres psql -U postgres -d magnetic_db -c \"UPDATE users SET is_admin = true WHERE id = '$USER_ID';\""
echo ""
read -p "Presiona ENTER cuando hayas ejecutado el comando SQL..."

# 3. Login
echo ""
echo "3️⃣ Haciendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Error al hacer login. ¿Marcaste el usuario como admin?"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo "✅ Login exitoso"
echo ""

# 4. Obtener productos
echo "4️⃣ Obteniendo productos disponibles..."
PRODUCTS_RESPONSE=$(curl -s -X GET "$API_URL/products" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$PRODUCTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PRODUCTS_RESPONSE"
echo ""

echo "5️⃣ Para asignar productos a este usuario, usa:"
echo ""
echo "curl -X POST $API_URL/products/assign/$USER_ID \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"productId\": \"PRODUCT_ID\","
echo "    \"externalUserId\": \"tu-id-en-el-producto\","
echo "    \"customDomain\": \"opcional.domain.com\""
echo "  }'"
echo ""
echo "📋 Datos guardados:"
echo "   User ID: $USER_ID"
echo "   Access Token: $ACCESS_TOKEN"
echo ""
