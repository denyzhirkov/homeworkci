import { DataObject } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function JsonModule() {
  return (
    <ModuleDoc
      id="mod-json"
      icon={<DataObject fontSize="small" />}
      title="json"
      description="JSON manipulation operations: parse strings, extract/modify values by path, stringify objects, and merge."
      params={[
        { name: 'op', type: '"parse" | "get" | "set" | "stringify" | "merge"', required: true, description: 'Operation type' },
        { name: 'input', type: 'any', required: true, description: 'Input data (string for parse, object for others)' },
        { name: 'path', type: 'string', description: 'JSONPath for get/set (e.g., $.data.items[0].id)' },
        { name: 'value', type: 'any', description: 'Value for set operation' },
        { name: 'merge', type: 'object', description: 'Object to merge with input' },
        { name: 'pretty', type: 'boolean', description: 'Pretty print for stringify (default: false)' },
        { name: 'indent', type: 'number', description: 'Indentation spaces (default: 2)' }
      ]}
      returns='parse: object. get: extracted value. set: modified object. stringify: string. merge: merged object'
      example={`// Parse JSON string
{
  "module": "json",
  "params": {
    "op": "parse",
    "input": "\${prev}"
  }
}

// Extract value by path
{
  "module": "json",
  "params": {
    "op": "get",
    "input": "\${results.apiResponse}",
    "path": "$.data.users[0].email"
  }
}

// Modify value at path
{
  "module": "json",
  "params": {
    "op": "set",
    "input": "\${results.config}",
    "path": "$.version",
    "value": "2.0.0"
  }
}

// Merge objects
{
  "module": "json",
  "params": {
    "op": "merge",
    "input": "\${results.defaults}",
    "merge": { "override": true, "extra": "value" }
  }
}`}
    />
  );
}
