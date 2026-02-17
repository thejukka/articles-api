#!/bin/bash
# Create EC2 instance using AWS CloudFormation template

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEMPLATE_FILE="ec2-template.yml"
STACK_NAME="${1:-articles-api-stack}"
KEY_NAME="${2}"
INSTANCE_TYPE="${3:-t3.medium}"
AWS_REGION="${4:-eu-north-1}"
PROFILE="${5:-default}"

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}\n"
}

# Display usage
if [ -z "$KEY_NAME" ]; then
  echo "Usage: ./ec2-launch.sh [STACK_NAME] [KEY_NAME] [INSTANCE_TYPE] [AWS_REGION] [PROFILE]"
  echo ""
  echo "Arguments:"
  echo "  STACK_NAME     - CloudFormation stack name (default: articles-api-stack)"
  echo "  KEY_NAME       - EC2 KeyPair name (required)"
  echo "  INSTANCE_TYPE  - EC2 instance type (default: t3.medium)"
  echo "  AWS_REGION     - AWS region (default: eu-north-1)"
  echo "  PROFILE        - AWS CLI profile (default: default)"
  echo ""
  echo "Example:"
  echo "  ./ec2-launch.sh articles-api-stack my-key-pair t3.medium eu-north-1 default"
  echo ""
  exit 1
fi

log_section "AWS EC2 Instance Creation via CloudFormation"

# Verify template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
  log_error "Template file '$TEMPLATE_FILE' not found"
  exit 1
fi
log_info "Template file found: $TEMPLATE_FILE"



# Verify AWS CLI is installed
if ! command -v aws &> /dev/null; then
  log_error "AWS CLI is not installed. Please install it first."
  exit 1
fi
log_info "AWS CLI found"



# Verify AWS credentials
if ! aws sts get-caller-identity --profile "$PROFILE" &> /dev/null; then
  log_error "Cannot authenticate with AWS using profile '$PROFILE'"
  exit 1
fi
log_info "AWS credentials verified with profile: $PROFILE"



# List available EC2 KeyPairs
log_info "Available EC2 KeyPairs in region '$AWS_REGION':"
aws ec2 describe-key-pairs \
  --region "$AWS_REGION" \
  --profile "$PROFILE" \
  --query 'KeyPairs[].KeyName' \
  --output table



# Verify the specified KeyPair exists
if ! aws ec2 describe-key-pairs \
  --key-names "$KEY_NAME" \
  --region "$AWS_REGION" \
  --profile "$PROFILE" &> /dev/null; then
  log_error "EC2 KeyPair '$KEY_NAME' not found in region '$AWS_REGION'"
  exit 1
fi
log_info "EC2 KeyPair verified: $KEY_NAME"



# Check if stack already exists
log_info "Checking if stack '$STACK_NAME' already exists..."
if aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$PROFILE" &> /dev/null; then
  log_warn "Stack '$STACK_NAME' already exists. Updating..."
  STACK_EXISTS=true
else
  log_info "Stack does not exist. Creating new stack..."
  STACK_EXISTS=false
fi



# Create or update CloudFormation stack
log_section "Creating CloudFormation Stack"

if [ "$STACK_EXISTS" = true ]; then
  log_info "Updating stack '$STACK_NAME'..."
  aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE_FILE" \
    --parameters "ParameterKey=KeyName,ParameterValue=$KEY_NAME" "ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE" \
    --region "$AWS_REGION" \
    --profile "$PROFILE" || log_warn "Stack update returned a message (stack may not have changes)"
else
  log_info "Creating stack '$STACK_NAME'..."
  aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE_FILE" \
    --parameters "ParameterKey=KeyName,ParameterValue=$KEY_NAME" "ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE" \
    --region "$AWS_REGION" \
    --profile "$PROFILE"
fi

if [ $? -eq 0 ]; then
  log_info "Stack creation/update initiated"
else
  log_error "Failed to create/update stack"
  exit 1
fi




# Wait for stack creation to complete
log_section "Waiting for Stack to Complete"
log_info "This may take several minutes..."

attempt=0
max_attempts=120
while [ $attempt -lt $max_attempts ]; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --profile "$PROFILE" \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "UNKNOWN")

  if [[ "$STATUS" == *"COMPLETE"* ]] && [[ ! "$STATUS" == *"IN_PROGRESS"* ]]; then
    log_info "Stack status: $STATUS"
    break
  elif [[ "$STATUS" == *"FAILED"* ]] || [[ "$STATUS" == *"ROLLBACK"* ]]; then
    log_error "Stack creation failed with status: $STATUS"
    exit 1
  fi

  echo -ne "${YELLOW}Stack status: ${STATUS}${NC}\r"
  sleep 5
  ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
  log_error "Timeout waiting for stack to complete"
  exit 1
fi




# Get stack outputs
log_section "Stack Outputs"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table

# Extract key outputs
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)

PUBLIC_IP=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text)




# Final summary
log_section "Instance Created Successfully!"

echo -e "${GREEN}Stack Name:${NC}        $STACK_NAME"
echo -e "${GREEN}Instance ID:${NC}       $INSTANCE_ID"
echo -e "${GREEN}Public IP:${NC}         $PUBLIC_IP"
echo -e "${GREEN}Instance Type:${NC}     $INSTANCE_TYPE"
echo -e "${GREEN}Region:${NC}            $AWS_REGION"
echo -e "${GREEN}KeyPair:${NC}           $KEY_NAME"
echo ""

log_info "Connect to your instance:"
echo "ssh -i /path/to/$KEY_NAME.pem ec2-user@$PUBLIC_IP"
echo ""

log_info "Deploy articles API:"
echo "./deploy.sh <REPO_URL> $PUBLIC_IP /path/to/$KEY_NAME.pem $AWS_REGION"
echo ""

log_info "View instance details:"
echo "aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $AWS_REGION --profile $PROFILE"
echo ""

exit 0