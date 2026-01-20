import { Http } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function HttpModule() {
  return (
    <ModuleDoc
      id="mod-http"
      icon={<Http fontSize="small" />}
      title="http"
      description="Performs HTTP requests. Supports GET, POST, PUT, DELETE methods with JSON body."
      params={[
        { name: 'url', type: 'string', required: true, description: 'Request URL' },
        { name: 'method', type: 'string', description: 'HTTP method (default: GET)' },
        { name: 'body', type: 'object', description: 'Request body (JSON)' }
      ]}
      returns="Response body as JSON object or string"
      example={`{
  "module": "http",
  "params": {
    "url": "https://api.example.com/users",
    "method": "POST",
    "body": { "name": "John", "email": "john@example.com" }
  }
}`}
    />
  );
}
