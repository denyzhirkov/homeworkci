import { Storage } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function S3Module() {
  return (
    <ModuleDoc
      id="mod-s3"
      icon={<Storage fontSize="small" />}
      title="s3"
      description="S3-compatible storage operations. Works with AWS S3, MinIO, DigitalOcean Spaces, and other compatible services."
      params={[
        { name: 'op', type: '"upload" | "download" | "list" | "delete"', required: true, description: 'Operation type' },
        { name: 'bucket', type: 'string', required: true, description: 'S3 bucket name' },
        { name: 'endpoint', type: 'string', required: true, description: 'S3-compatible endpoint URL' },
        { name: 'accessKey', type: 'string', required: true, description: 'Access key ID' },
        { name: 'secretKey', type: 'string', required: true, description: 'Secret access key' },
        { name: 'key', type: 'string', description: 'Object key (path in bucket)' },
        { name: 'source', type: 'string', description: 'Local file path for upload' },
        { name: 'output', type: 'string', description: 'Local path for download' },
        { name: 'prefix', type: 'string', description: 'Prefix filter for list operation' },
        { name: 'region', type: 'string', description: 'AWS region (default: us-east-1)' },
        { name: 'contentType', type: 'string', description: 'Content-Type for upload (auto-detected)' },
        { name: 'acl', type: 'string', description: 'ACL: private, public-read, etc.' }
      ]}
      returns='upload/download: { "success": true, "key": "...", "size": 12345 }. list: { "objects": [...], "count": 10 }'
      example={`// Upload build artifacts
{
  "module": "s3",
  "params": {
    "op": "upload",
    "bucket": "my-artifacts",
    "source": "./dist/build.zip",
    "key": "releases/\${pipelineId}/build.zip",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}

// Download artifact
{
  "module": "s3",
  "params": {
    "op": "download",
    "bucket": "my-artifacts",
    "key": "releases/latest.zip",
    "output": "./download.zip",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}

// List objects
{
  "module": "s3",
  "params": {
    "op": "list",
    "bucket": "my-artifacts",
    "prefix": "releases/",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}`}
    />
  );
}
