#!/bin/sh

set -e

if [ -z "$*" ]; 
then 
  echo "Usage: ./deploy.sh [REPO_URL] [INSTANCE_IP] [KEY_PATH] [AWS_REGION] [INSTANCE_TYPE]"; 
  echo
  exit 1
fi


# Configuration
# Usage: ./deploy.sh [REPO_URL] [INSTANCE_IP] [KEY_PATH] [AWS_REGION] [INSTANCE_TYPE]
REPO_URL="${1:?Error: Repository URL required as first argument}"
INSTANCE_IP="${2:?Error: Instance IP required as second argument}"
KEY_PATH="${3:?Error: SSH key path required as third argument}"
AWS_REGION="${4:-eu-north-1}"
INSTANCE_TYPE="${5:-t3.medium}"
IMAGE_NAME="articles-api"
IMAGE_TAG="latest"
CONTAINER_PORT=3000
HOST_PORT=3000

echo "Articles API Deployment Script"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color


# Function to print colored output
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}




# Build Docker image locally
log_info "Building Docker image locally..."
docker build -t $IMAGE_NAME:$IMAGE_TAG .

if [ $? -eq 0 ]; then
  log_info "Docker image built successfully"
else
  log_error "Failed to build Docker image"
  exit 1
fi



# Verify SSH access to EC2
log_info "Verifying SSH access to EC2 instance at $INSTANCE_IP..."
if ! ssh -i "$KEY_PATH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP "echo 'SSH connection successful'" > /dev/null 2>&1; then
  log_error "Cannot connect to EC2 instance at $INSTANCE_IP"
  exit 1
fi
log_info "SSH connection verified"




# Clone repository on EC2
log_info "Cloning repository on EC2 instance..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP << EOF
  if [ -d "articles-api" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd articles-api
    git pull origin main || git pull origin master
  else
    echo "Cloning repository..."
    git clone $REPO_URL articles-api
    cd articles-api
  fi
EOF

if [ $? -eq 0 ]; then
  log_info "Repository ready on EC2"
else
  log_error "Failed to clone/update repository"
  exit 1
fi




# Build and run Docker container on EC2
log_info "Building and starting Docker container on EC2..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP << 'EOF'
  cd articles-api
  
  # Stop existing container if running
  echo "Stopping existing containers..."
  docker-compose down || true
  
  # Build image
  echo "Building Docker image on EC2..."
  docker build -t articles-api:latest .
  
  # Start container
  echo "Starting Docker container..."
  docker-compose up -d
  
  # Check if container is running
  if docker ps | grep -q articles-api; then
    echo "Container started successfully"
  else
    echo "WARNING: Container may not have started properly"
    docker logs articles_api_1 || docker logs articles-api
  fi
EOF

if [ $? -eq 0 ]; then
  log_info "Docker container deployed successfully"
else
  log_error "Failed to deploy Docker container"
  exit 1
fi




# Verify deployment
log_info "Verifying deployment..."
sleep 3
HEALTH_CHECK=$(ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP "curl -s http://localhost:$HOST_PORT/ping" 2>/dev/null || echo "")

if echo "$HEALTH_CHECK" | grep -q "pong"; then
  log_info "Health check passed! API is running"
else
  log_warn "Health check failed or API not responding yet"
fi





# Display deployment information
log_info "Deployment Complete!"
echo -e "${GREEN}API URL:${NC} http://$INSTANCE_IP:$HOST_PORT"
echo -e "${GREEN}Swagger Docs:${NC} http://$INSTANCE_IP:$HOST_PORT/api-docs"
echo -e "${GREEN}Health Check:${NC} http://$INSTANCE_IP:$HOST_PORT/ping"
echo ""
log_info "To SSH into the instance:"
echo "ssh -i $KEY_PATH ec2-user@$INSTANCE_IP"
echo ""
log_info "To view container logs:"
echo "ssh -i $KEY_PATH ec2-user@$INSTANCE_IP 'docker logs -f articles_api_1'"

exit 0