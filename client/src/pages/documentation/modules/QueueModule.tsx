import { CloudQueue } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function QueueModule() {
  return (
    <ModuleDoc
      id="mod-queue"
      icon={<CloudQueue fontSize="small" />}
      title="queue"
      description="Message queue operations for RabbitMQ, Redis, AWS SQS, and Google Cloud Pub/Sub. Supports publish (send) and consume (receive) operations."
      params={[
        { name: 'op', type: 'string', required: true, description: 'Operation: publish (send) or consume (receive)' },
        { name: 'provider', type: 'string', required: true, description: 'Provider: rabbitmq, redis, sqs, pubsub' },
        { name: 'message', type: 'string | object', description: 'Message to publish (string or JSON object). Supports interpolation: ${BUILD_ID}' },
        { name: 'timeout', type: 'number', description: 'Timeout in seconds for consume operation (default: 10)' },
        { name: 'host', type: 'string', description: 'RabbitMQ/Redis: Management API endpoint (e.g., http://localhost:15672)' },
        { name: 'username', type: 'string', description: 'RabbitMQ: Username' },
        { name: 'password', type: 'string', description: 'RabbitMQ: Password' },
        { name: 'vhost', type: 'string', description: 'RabbitMQ: Virtual host (default: /)' },
        { name: 'exchange', type: 'string', description: 'RabbitMQ: Exchange name (for publish)' },
        { name: 'routingKey', type: 'string', description: 'RabbitMQ: Routing key (for publish)' },
        { name: 'queue', type: 'string', description: 'RabbitMQ: Queue name (for consume)' },
        { name: 'apiKey', type: 'string', description: 'Redis: API key (if required)' },
        { name: 'channel', type: 'string', description: 'Redis: Pub/Sub channel name' },
        { name: 'list', type: 'string', description: 'Redis: List name (alternative to channel)' },
        { name: 'queueUrl', type: 'string', description: 'AWS SQS: Queue URL' },
        { name: 'region', type: 'string', description: 'AWS SQS: AWS region (default: us-east-1)' },
        { name: 'accessKey', type: 'string', description: 'AWS SQS: Access key ID' },
        { name: 'secretKey', type: 'string', description: 'AWS SQS: Secret access key' },
        { name: 'project', type: 'string', description: 'Google Cloud Pub/Sub: Project ID' },
        { name: 'topic', type: 'string', description: 'Google Cloud Pub/Sub: Topic name (for publish)' },
        { name: 'subscription', type: 'string', description: 'Google Cloud Pub/Sub: Subscription name (for consume)' },
        { name: 'serviceAccount', type: 'object', description: 'Google Cloud Pub/Sub: Service account JSON object' }
      ]}
      returns='Publish: { success: true, messageId: string, provider: string }. Consume (success): { success: true, message: string, messageId: string, provider: string }. Consume (no message): { success: false, timeout: true }'
      example={`// RabbitMQ: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "rabbitmq",
    "host": "http://localhost:15672",
    "username": "\${env.RABBITMQ_USER}",
    "password": "\${env.RABBITMQ_PASS}",
    "exchange": "notifications",
    "routingKey": "build.completed",
    "message": "Build \${BUILD_ID} completed successfully"
  }
}

// RabbitMQ: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "rabbitmq",
    "host": "http://localhost:15672",
    "username": "\${env.RABBITMQ_USER}",
    "password": "\${env.RABBITMQ_PASS}",
    "queue": "build-queue",
    "timeout": 10
  }
}

// AWS SQS: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "sqs",
    "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
    "region": "us-east-1",
    "accessKey": "\${env.AWS_ACCESS_KEY}",
    "secretKey": "\${env.AWS_SECRET_KEY}",
    "message": {
      "buildId": "\${BUILD_ID}",
      "status": "success",
      "timestamp": "\${UNIXTIMESTAMP}"
    }
  }
}

// AWS SQS: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "sqs",
    "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
    "region": "us-east-1",
    "accessKey": "\${env.AWS_ACCESS_KEY}",
    "secretKey": "\${env.AWS_SECRET_KEY}",
    "timeout": 20
  }
}

// Google Cloud Pub/Sub: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "pubsub",
    "project": "my-project",
    "topic": "build-events",
    "serviceAccount": \${env.GCP_SERVICE_ACCOUNT},
    "message": "Build \${BUILD_ID} completed"
  }
}

// Google Cloud Pub/Sub: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "pubsub",
    "project": "my-project",
    "subscription": "build-subscription",
    "serviceAccount": \${env.GCP_SERVICE_ACCOUNT},
    "timeout": 10
  }
}

// Redis: Publish to channel (requires HTTP API)
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "redis",
    "host": "http://localhost:8080",
    "channel": "notifications",
    "message": "Build \${BUILD_ID} started"
  }
}`}
    />
  );
}
